defmodule Notifications.BookingEventsPipeline do
  @moduledoc """
  Reads booking events from Kafka and turns them into reminders.

  A Broadway pipeline: `BroadwayKafka.Producer` joins the consumer group
  `notifications-reminders` on `tutorhub.bookings.v1` (published by the API's
  outbox relay) and hands each message to `handle_message/3`, which applies it
  to `Notifications.Reminders`. Its own consumer group means it gets every
  event independently of the API's `notifications` group.

  Messages are keyed by booking id, so all events of one booking sit in one
  partition, and BroadwayKafka processes a partition's messages in order.
  Offsets are committed after messages are handled — at-least-once — so a
  restart can replay a few; the version check in `Reminders` makes that safe.

  Started by `Notifications.Application` only when `KAFKA_BROKERS` is set.
  """
  use Broadway
  require Logger

  alias Broadway.Message
  alias Notifications.Reminders

  @topic "tutorhub.bookings.v1"
  @group_id "notifications-reminders"

  @doc """
  Options: `:brokers` — e.g. `"localhost:9092"` (comma-separated);
  `:producer` — overrides the Kafka producer (tests use `Broadway.DummyProducer`).
  """
  def start_link(opts) do
    Broadway.start_link(__MODULE__,
      name: __MODULE__,
      producer: [module: Keyword.get_lazy(opts, :producer, fn -> kafka(opts) end), concurrency: 1],
      processors: [default: [concurrency: 2]]
    )
  end

  @impl true
  def handle_message(_processor, %Message{data: data} = message, _context) do
    with {:ok, event} <- Jason.decode(data),
         {:ok, outcome} <- Reminders.apply_event(event) do
      Logger.debug("Booking event #{event["eventId"]}: #{outcome}")
      message
    else
      {:error, reason} -> Message.failed(message, reason)
    end
  end

  # A bad message is logged and skipped: its offset is still committed, so
  # it can't block the partition behind it.
  @impl true
  def handle_failed(messages, _context) do
    Enum.each(messages, fn %Message{status: {:failed, reason}} ->
      Logger.warning("Skipping booking event that could not be applied: #{inspect(reason)}")
    end)

    messages
  end

  defp kafka(opts) do
    {BroadwayKafka.Producer,
     [
       # BroadwayKafka takes the "host:port,host:port" string as it is.
       hosts: Keyword.fetch!(opts, :brokers),
       group_id: @group_id,
       topics: [@topic],
       # A new group starts from the oldest event still in the topic.
       offset_reset_policy: :earliest
     ]}
  end
end
