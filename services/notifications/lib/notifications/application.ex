defmodule Notifications.Application do
  # See https://elixir.hexdocs.pm/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children =
      [
        NotificationsWeb.Telemetry,
        {DNSCluster, query: Application.get_env(:notifications, :dns_cluster_query) || :ignore},
        {Phoenix.PubSub, name: Notifications.PubSub},
        # In-memory reminder store; always running.
        Notifications.Reminders
      ] ++ scheduler() ++ [NotificationsWeb.Endpoint]

    # See https://elixir.hexdocs.pm/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Notifications.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # The periodic delivery loop runs everywhere except tests, where reminders
  # are delivered explicitly for determinism.
  defp scheduler do
    if Application.get_env(:notifications, :start_scheduler, true) do
      [Notifications.Scheduler]
    else
      []
    end
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    NotificationsWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
