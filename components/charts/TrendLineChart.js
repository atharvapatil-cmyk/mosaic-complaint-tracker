'use client'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

export default function TrendLineChart({ datasets, labels, title }) {
  if (!datasets || datasets.length === 0 || !labels) {
    return <div className="text-center py-8 text-gray-400">No trend data</div>
  }

  const COLORS = ['#3b82f6', '#e11d48', '#059669', '#f59e0b', '#8b5cf6']

  const data = {
    labels,
    datasets: datasets.map((ds, i) => ({
      label: ds.label,
      data: ds.data,
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: COLORS[i % COLORS.length] + '15',
      borderWidth: 2.5,
      pointRadius: 4,
      pointHoverRadius: 6,
      fill: datasets.length === 1,
      tension: 0.35,
    }))
  }

  const options = {
    responsive: true,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: datasets.length > 1,
        position: 'top',
        labels: { font: { size: 12 }, usePointStyle: true }
      },
      tooltip: {
        backgroundColor: '#111827',
        padding: 10,
        titleFont: { size: 13 },
        bodyFont: { size: 12 },
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: '#f3f4f6' },
        ticks: { font: { size: 11 } }
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: 10 } }
      }
    }
  }

  return <Line data={data} options={options} height={180} />
}
