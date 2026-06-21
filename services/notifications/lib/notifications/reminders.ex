defmodule Notifications.Reminders do
  @moduledoc """
  Schedules and delivers lesson reminders from booking events.

  A booking arriving on the webhook is turned into a `Reminder` due
  `@lead_minutes` before the lesson. The store is an in-memory `GenServer`
  (no database for this demo service); `deliver_due/2` sends every reminder
  whose time has passed and marks it delivered so it is sent at most once.
  Delivery is mocked (logged), in the spirit of the project's mocked payments.
  """
  use GenServer
  require Logger

  @lead_minutes 60

  defmodule Reminder do
    @moduledoc "A scheduled lesson reminder."
    @enforce_keys [:booking_id, :subject, :tutor_name, :start_time, :remind_at]
    defstruct [:booking_id, :subject, :tutor_name, :start_time, :remind_at, delivered: false]
  end

  # --- Client API ----------------------------------------------------------

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, :ok, name: Keyword.get(opts, :name, __MODULE__))
  end

  @doc "Schedule a reminder from a booking event (string-keyed map)."
  @spec schedule(GenServer.server(), map()) :: {:ok, Reminder.t()} | {:error, term()}
  def schedule(server \\ __MODULE__, booking), do: GenServer.call(server, {:schedule, booking})

  @doc "All scheduled reminders."
  def all(server \\ __MODULE__), do: GenServer.call(server, :all)

  @doc "Deliver every undelivered reminder due at or before `now`; returns them."
  def deliver_due(now \\ DateTime.utc_now(), server \\ __MODULE__),
    do: GenServer.call(server, {:deliver_due, now})

  @doc "Forget all reminders (used between tests)."
  def clear(server \\ __MODULE__), do: GenServer.call(server, :clear)

  # --- Server callbacks ----------------------------------------------------

  @impl true
  def init(:ok), do: {:ok, %{}}

  @impl true
  def handle_call({:schedule, booking}, _from, state) do
    case build(booking) do
      {:ok, reminder} -> {:reply, {:ok, reminder}, Map.put(state, reminder.booking_id, reminder)}
      {:error, _} = err -> {:reply, err, state}
    end
  end

  def handle_call(:all, _from, state), do: {:reply, Map.values(state), state}

  def handle_call(:clear, _from, _state), do: {:reply, :ok, %{}}

  def handle_call({:deliver_due, now}, _from, state) do
    {due, _later} =
      state
      |> Map.values()
      |> Enum.split_with(fn r -> not r.delivered and not future?(r.remind_at, now) end)

    delivered = Enum.map(due, fn r -> %{r | delivered: true} end)
    Enum.each(delivered, &deliver/1)
    new_state = Enum.reduce(delivered, state, fn r, acc -> Map.put(acc, r.booking_id, r) end)
    {:reply, delivered, new_state}
  end

  # --- Internals -----------------------------------------------------------

  defp build(%{"id" => id, "startTime" => start_iso} = booking)
       when is_binary(id) and is_binary(start_iso) do
    case DateTime.from_iso8601(start_iso) do
      {:ok, start, _offset} ->
        {:ok,
         %Reminder{
           booking_id: id,
           subject: Map.get(booking, "subject", "your lesson"),
           tutor_name: Map.get(booking, "tutorName", "your tutor"),
           start_time: start,
           remind_at: DateTime.add(start, -@lead_minutes * 60, :second)
         }}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp build(_), do: {:error, :invalid_booking}

  defp future?(remind_at, now), do: DateTime.compare(remind_at, now) == :gt

  defp deliver(%Reminder{} = r) do
    Logger.info(
      "Reminder sent: #{r.subject} with #{r.tutor_name} at #{DateTime.to_iso8601(r.start_time)}"
    )
  end
end
