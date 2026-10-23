defmodule NotificationsWeb.Router do
  use NotificationsWeb, :router

  # Booking events used to arrive on `POST /api/bookings`; they now come from
  # Kafka (`Notifications.BookingEventsPipeline`), so there are no routes.
  pipeline :api do
    plug :accepts, ["json"]
  end
end
