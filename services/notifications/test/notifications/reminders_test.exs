defmodule Notifications.RemindersTest do
  use ExUnit.Case, async: false

  alias Notifications.Reminders

  setup do
    Reminders.clear()
    :ok
  end

  # A booking event as the API's outbox publishes it.
  defp event(status, version, start_iso \\ "2026-06-22T14:00:00Z") do
    %{
      "eventId" => "e-#{version}",
      "type" => "BookingStatusChanged",
      "version" => 1,
      "data" => %{
        "bookingId" => "b1",
        "status" => status,
        "startTime" => start_iso,
        "bookingVersion" => version
      }
    }
  end

  test "a confirmed booking schedules a reminder one hour before the lesson" do
    assert {:ok, :scheduled} = Reminders.apply_event(event("CONFIRMED", 1))
    [reminder] = Reminders.all()
    assert DateTime.to_iso8601(reminder.remind_at) == "2026-06-22T13:00:00Z"
    assert reminder.delivered == false
  end

  test "a pending request schedules nothing" do
    assert {:ok, :ignored} = Reminders.apply_event(event("PENDING", 0))
    assert Reminders.all() == []
  end

  test "the same event twice is applied once (duplicate = stale version)" do
    assert {:ok, :scheduled} = Reminders.apply_event(event("CONFIRMED", 1))
    assert {:ok, :stale} = Reminders.apply_event(event("CONFIRMED", 1))
    assert length(Reminders.all()) == 1
  end

  test "a reschedule moves the reminder" do
    {:ok, :scheduled} = Reminders.apply_event(event("CONFIRMED", 1))
    {:ok, :scheduled} = Reminders.apply_event(event("CONFIRMED", 2, "2026-06-23T09:00:00Z"))
    [reminder] = Reminders.all()
    assert DateTime.to_iso8601(reminder.remind_at) == "2026-06-23T08:00:00Z"
  end

  test "a cancel that overtakes the confirmation wins (out of order)" do
    assert {:ok, :cancelled} = Reminders.apply_event(event("CANCELLED", 2))
    assert {:ok, :stale} = Reminders.apply_event(event("CONFIRMED", 1))
    assert Reminders.deliver_due(~U[2026-06-22 13:05:00Z]) == []
  end

  test "rejects a malformed event" do
    assert {:error, :invalid_event} = Reminders.apply_event(%{"data" => %{"bookingId" => "b1"}})
    assert Reminders.all() == []
  end

  test "delivers only reminders that are due, and only once" do
    {:ok, :scheduled} = Reminders.apply_event(event("CONFIRMED", 1))
    # remind_at is 13:00; nothing is due an hour earlier.
    assert Reminders.deliver_due(~U[2026-06-22 12:30:00Z]) == []

    # At/after 13:00 it is delivered exactly once.
    [delivered] = Reminders.deliver_due(~U[2026-06-22 13:05:00Z])
    assert delivered.booking_id == "b1"
    assert delivered.delivered == true
    assert Reminders.deliver_due(~U[2026-06-22 13:05:00Z]) == []
  end
end
