defmodule Notifications.RemindersTest do
  use ExUnit.Case, async: false

  alias Notifications.Reminders

  setup do
    Reminders.clear()
    :ok
  end

  defp booking(id, start_iso) do
    %{"id" => id, "subject" => "Maths", "tutorName" => "Ben Carter", "startTime" => start_iso}
  end

  test "schedules a reminder one hour before the lesson" do
    {:ok, reminder} = Reminders.schedule(booking("b1", "2026-06-22T14:00:00Z"))
    assert reminder.subject == "Maths"
    assert DateTime.to_iso8601(reminder.remind_at) == "2026-06-22T13:00:00Z"
    assert reminder.delivered == false
  end

  test "rejects a malformed booking event" do
    assert {:error, _} = Reminders.schedule(%{"id" => "b1"})
    assert Reminders.all() == []
  end

  test "delivers only reminders that are due, and only once" do
    {:ok, _} = Reminders.schedule(booking("b1", "2026-06-22T14:00:00Z"))
    # remind_at is 13:00; nothing is due an hour earlier.
    assert Reminders.deliver_due(~U[2026-06-22 12:30:00Z]) == []

    # At/after 13:00 it is delivered exactly once.
    [delivered] = Reminders.deliver_due(~U[2026-06-22 13:05:00Z])
    assert delivered.booking_id == "b1"
    assert delivered.delivered == true
    assert Reminders.deliver_due(~U[2026-06-22 13:05:00Z]) == []
  end
end
