defmodule NotificationsWeb.BookingControllerTest do
  use NotificationsWeb.ConnCase, async: false

  alias Notifications.Reminders

  setup do
    Reminders.clear()
    :ok
  end

  test "POST /api/bookings schedules a reminder", %{conn: conn} do
    body = %{
      "id" => "booking-1",
      "subject" => "Maths",
      "tutorName" => "Ben Carter",
      "startTime" => "2026-06-22T14:00:00Z"
    }

    conn = post(conn, ~p"/api/bookings", body)

    assert json_response(conn, 202) == %{
             "scheduled" => true,
             "remindAt" => "2026-06-22T13:00:00Z"
           }

    assert [reminder] = Reminders.all()
    assert reminder.booking_id == "booking-1"
  end

  test "POST /api/bookings rejects an invalid event", %{conn: conn} do
    conn = post(conn, ~p"/api/bookings", %{"id" => "x"})
    assert json_response(conn, 400)["scheduled"] == false
  end
end
