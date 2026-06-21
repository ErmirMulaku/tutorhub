defmodule NotificationsWeb.BookingController do
  @moduledoc """
  Webhook the API calls when a booking is created/confirmed. Each event is
  turned into a scheduled lesson reminder.
  """
  use NotificationsWeb, :controller

  alias Notifications.Reminders

  def create(conn, params) do
    case Reminders.schedule(params) do
      {:ok, reminder} ->
        conn
        |> put_status(:accepted)
        |> json(%{scheduled: true, remindAt: DateTime.to_iso8601(reminder.remind_at)})

      {:error, _reason} ->
        conn
        |> put_status(:bad_request)
        |> json(%{scheduled: false, error: "invalid booking event"})
    end
  end
end
