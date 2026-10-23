defmodule Notifications.Reminders do
  @moduledoc """
  Schedules and delivers lesson reminders from booking events.

  Booking events come from Kafka (`tutorhub.bookings.v1`, see
  `Notifications.BookingEventsPipeline`). A confirmed booking becomes a
  `Reminder` due `@lead_minutes` before the lesson; a reschedule moves it; a
  cancellation (or a finished lesson) cancels it.

  Kafka delivers at least once and may deliver events of one booking out of
  order, so every reminder remembers the booking's `version` (it goes up by
  one on every change). An event whose version is not newer than the one we
  hold is a duplicate or stale, and is ignored. That makes the store
  idempotent without a separate "processed events" table.

  The store is an in-memory `GenServer` (no database for this demo service);
  `deliver_due/2` sends every live reminder whose time has passed and marks
  it delivered so it is sent at most once. Delivery is mocked (logged).
  """
  use GenServer
  require Logger

  @lead_minutes 60

  defmodule Reminder do
    @moduledoc "A scheduled lesson reminder, or a cancelled one kept as a tombstone."
    @enforce_keys [:booking_id, :version, :start_time, :remind_at]
    defstruct [
      :booking_id,
      :version,
      :start_time,
      :remind_at,
      subject: "your lesson",
      tutor_name: "your tutor",
      delivered: false,
      cancelled: false
    ]
  end

  @typedoc "What applying an event did."
  @type outcome :: :scheduled | :cancelled | :ignored | :stale

  # --- Client API ----------------------------------------------------------

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, :ok, name: Keyword.get(opts, :name, __MODULE__))
  end

  @doc """
  Apply one booking event (the decoded Kafka message, string keys).
  Returns `{:ok, outcome}` or `{:error, :invalid_event}`.
  """
  @spec apply_event(GenServer.server(), map()) :: {:ok, outcome()} | {:error, :invalid_event}
  def apply_event(server \\ __MODULE__, event), do: GenServer.call(server, {:apply, event})

  @doc "All reminders, including cancelled ones."
  def all(server \\ __MODULE__), do: GenServer.call(server, :all)

  @doc "Deliver every live, undelivered reminder due at or before `now`; returns them."
  def deliver_due(now \\ DateTime.utc_now(), server \\ __MODULE__),
    do: GenServer.call(server, {:deliver_due, now})

  @doc "Forget all reminders (used between tests)."
  def clear(server \\ __MODULE__), do: GenServer.call(server, :clear)

  # --- Server callbacks ----------------------------------------------------

  @impl true
  def init(:ok), do: {:ok, %{}}

  @impl true
  def handle_call({:apply, event}, _from, state) do
    case parse(event) do
      {:ok, change} ->
        {outcome, new_state} = apply_change(change, state)
        {:reply, {:ok, outcome}, new_state}

      :error ->
        {:reply, {:error, :invalid_event}, state}
    end
  end

  def handle_call(:all, _from, state), do: {:reply, Map.values(state), state}

  def handle_call(:clear, _from, _state), do: {:reply, :ok, %{}}

  def handle_call({:deliver_due, now}, _from, state) do
    due =
      state
      |> Map.values()
      |> Enum.filter(fn r ->
        not r.cancelled and not r.delivered and not future?(r.remind_at, now)
      end)

    delivered = Enum.map(due, fn r -> %{r | delivered: true} end)
    Enum.each(delivered, &deliver/1)
    new_state = Enum.reduce(delivered, state, fn r, acc -> Map.put(acc, r.booking_id, r) end)
    {:reply, delivered, new_state}
  end

  # --- Internals -----------------------------------------------------------

  # Duplicates and out-of-order events: never go backwards.
  defp apply_change(%{booking_id: id, version: version} = change, state) do
    case Map.get(state, id) do
      %Reminder{version: seen} when seen >= version -> {:stale, state}
      _ -> apply_status(change, state)
    end
  end

  defp apply_status(%{status: "CONFIRMED"} = change, state) do
    reminder = %Reminder{
      booking_id: change.booking_id,
      version: change.version,
      start_time: change.start_time,
      remind_at: DateTime.add(change.start_time, -@lead_minutes * 60, :second)
    }

    {:scheduled, Map.put(state, change.booking_id, reminder)}
  end

  # Always keep a tombstone, even with no reminder yet: if this cancel (say
  # version 2) overtook the confirmation (version 1), the late confirmation
  # must find version 2 here and be ignored instead of scheduling a reminder.
  defp apply_status(%{status: status} = change, state)
       when status in ["CANCELLED", "COMPLETED", "NO_SHOW"] do
    tombstone = %Reminder{
      booking_id: change.booking_id,
      version: change.version,
      start_time: change.start_time,
      remind_at: change.start_time,
      cancelled: true
    }

    {:cancelled, Map.put(state, change.booking_id, tombstone)}
  end

  # PENDING: nothing to remind about until the tutor confirms.
  defp apply_status(_change, state), do: {:ignored, state}

  defp parse(%{
         "data" => %{
           "bookingId" => id,
           "status" => status,
           "startTime" => start_iso,
           "bookingVersion" => version
         }
       })
       when is_binary(id) and is_binary(status) and is_binary(start_iso) and is_integer(version) do
    case DateTime.from_iso8601(start_iso) do
      {:ok, start, _offset} ->
        {:ok, %{booking_id: id, status: status, start_time: start, version: version}}

      {:error, _} ->
        :error
    end
  end

  defp parse(_), do: :error

  defp future?(remind_at, now), do: DateTime.compare(remind_at, now) == :gt

  defp deliver(%Reminder{} = r) do
    Logger.info(
      "Reminder sent: #{r.subject} with #{r.tutor_name} at #{DateTime.to_iso8601(r.start_time)}"
    )
  end
end
