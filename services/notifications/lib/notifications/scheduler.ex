defmodule Notifications.Scheduler do
  @moduledoc """
  Periodically asks `Notifications.Reminders` to deliver any due reminders.
  Disabled in the test environment, where delivery is driven explicitly.
  """
  use GenServer

  @default_interval_ms 60_000

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(opts) do
    interval = Keyword.get(opts, :interval_ms, @default_interval_ms)
    schedule_tick(interval)
    {:ok, %{interval: interval}}
  end

  @impl true
  def handle_info(:tick, %{interval: interval} = state) do
    Notifications.Reminders.deliver_due()
    schedule_tick(interval)
    {:noreply, state}
  end

  defp schedule_tick(interval), do: Process.send_after(self(), :tick, interval)
end
