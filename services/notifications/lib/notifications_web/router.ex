defmodule NotificationsWeb.Router do
  use NotificationsWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/api", NotificationsWeb do
    pipe_through :api

    post "/bookings", BookingController, :create
  end
end
