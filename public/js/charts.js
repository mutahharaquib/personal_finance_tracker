(() => {
  "use strict";
  if (!window.Chart) return;

  const dataEl = document.getElementById("chart-data");
  if (!dataEl) return;
  const data = JSON.parse(dataEl.textContent);
  const money = new Intl.NumberFormat(data.locale || "en-IN", {
    style: "currency", currency: data.currency || "INR", maximumFractionDigits: 0,
  });
  const compact = new Intl.NumberFormat(data.locale || "en-IN", {
    style: "currency", currency: data.currency || "INR", notation: "compact", maximumFractionDigits: 1,
  });

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const charts = [];

  function baseOptions() {
    Chart.defaults.font.family = css("--font") || "Inter, system-ui, sans-serif";
    Chart.defaults.color = css("--muted");
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { labels: { usePointStyle: true, pointStyle: "rectRounded", boxWidth: 8, padding: 16 } },
        tooltip: {
          backgroundColor: css("--surface"),
          titleColor: css("--text"),
          bodyColor: css("--text-2"),
          borderColor: css("--border"),
          borderWidth: 1,
          padding: 10,
          cornerRadius: 10,
          callbacks: { label: (ctx) => ` ${ctx.dataset.label || ctx.label}: ${money.format(ctx.parsed.y ?? ctx.parsed)}` },
        },
      },
    };
  }

  function axes() {
    return {
      x: { grid: { display: false }, border: { display: false } },
      y: {
        beginAtZero: true,
        grid: { color: css("--border") },
        border: { display: false },
        ticks: { callback: (v) => compact.format(v), maxTicksLimit: 6 },
      },
    };
  }

  const builders = {
    cashflow(canvas, d) {
      return new Chart(canvas, {
        type: "bar",
        data: {
          labels: d.labels,
          datasets: [
            { label: "Income", data: d.income, backgroundColor: css("--income"), borderRadius: 6, maxBarThickness: 28 },
            { label: "Expenses", data: d.expense, backgroundColor: css("--expense"), borderRadius: 6, maxBarThickness: 28 },
          ],
        },
        options: { ...baseOptions(), scales: axes() },
      });
    },

    trend(canvas, d) {
      const line = (label, values, color) => ({
        label, data: values, borderColor: color, backgroundColor: color + "22",
        fill: true, tension: 0.2, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2,
      });
      return new Chart(canvas, {
        type: "line",
        data: { labels: d.labels, datasets: [line("Income", d.income, css("--income")), line("Expenses", d.expense, css("--expense"))] },
        options: { ...baseOptions(), scales: { ...axes(), x: { grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: 8 } } } },
      });
    },

    categories(canvas, d) {
      const opts = baseOptions();
      opts.plugins.legend = { display: false };
      opts.plugins.tooltip.callbacks = { label: (ctx) => ` ${ctx.label}: ${money.format(ctx.parsed)}` };
      delete opts.interaction;
      return new Chart(canvas, {
        type: "doughnut",
        data: {
          labels: d.map((c) => c.label),
          datasets: [{ data: d.map((c) => c.value), backgroundColor: d.map((c) => c.color), borderColor: css("--surface"), borderWidth: 3, hoverOffset: 6 }],
        },
        options: { ...opts, cutout: "70%" },
      });
    },
  };

  function render() {
    charts.splice(0).forEach((c) => c.destroy());
    document.querySelectorAll("canvas[data-chart]").forEach((canvas) => {
      const key = canvas.dataset.chart;
      const d = data[key];
      if (d && builders[key]) charts.push(builders[key](canvas, d));
    });
  }

  render();
  document.addEventListener("themechange", render);
})();
