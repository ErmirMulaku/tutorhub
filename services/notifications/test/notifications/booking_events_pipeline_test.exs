defmodule Notifications.BookingEventsPipelineTest do
  use ExUnit.Case, async: false

  alias Notifications.{BookingEventsPipeline, Reminders}

  setup do
    Reminders.clear()
    # Broadway's test producer instead of Kafka: same pipeline, no broker.
    start_supervised!({BookingEventsPipeline, producer: {Broadway.DummyProducer, []}})
    :ok
  end

  test "a Kafka message becomes a reminder" do
    json =
      Jason.encode!(%{
        "eventId" => "e1",
        "type" => "BookingStatusChanged",
        "version" => 1,
        "data" => %{
          "bookingId" => "b1",
          "status" => "CONFIRMED",
          "startTime" => "2026-06-22T14:00:00Z",
          "bookingVersion" => 1
        }
      })

    ref = Broadway.test_message(BookingEventsPipeline, json)

    assert_receive {:ack, ^ref, [_successful], []}
    assert [%{booking_id: "b1"}] = Reminders.all()
  end

  test "a malformed message fails without crashing the pipeline" do
    ref = Broadway.test_message(BookingEventsPipeline, "not json")
    assert_receive {:ack, ^ref, [], [_failed]}
    assert Reminders.all() == []
  end
end
