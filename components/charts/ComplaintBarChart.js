'use client'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const BUCKET_COLORS = {
  'Delivery Issue': '#3b82f6',
  'Primary Packaging Issue': '#f59e0b',
  'Secondary Packaging Issue': '#8b5cf6',
  'Product Quality Issue': '#ef4444',
  'Infestation': '#dc2626',
  'Product Performance': '#06b6d4',
  'Technical Issue': '#64748b',
  'Other': '#9ca3af'
}

export default function ComplaintBarChart({ reportData, reportView }) {
  const { byBucket = {} } = reportData

  const filtered = Object.entries(byBucket).filter(([k]) =>
    reportView === 'delivery' ? k === 'Delivery Issue' : k !== 'Delivery Issue'
  ).sort((a, b) => b[1] - a[1])

  if (filtered.length === 0) return <div className="text-center py-8 text-gray-400">No data</div>

  const data = {
    labels: filtered.map(([k]) => k.length > 25 ? k.slice(0, 25) + '\u2026' : k),
    datasets: [{
      label: 'Complaints',
      data: filtered.map(([, v]) => v),
      backgroundColor: filtered.map(([k]) => (BUCKET_COLORS[k] || '#9ca3af') + 'cc'),
      borderColor: filtered.map(([k]) => BUCKET_COLORS[k] || '#9ca3af'),
      borderWidth: 1.5,
      borderRadius: 6,
    }]
  }

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => ` ${ctx.raw} complaints`
        }
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
        ticks: { font: { size: 11 } }
      }
    }
  }

  return <Bar data={data} options={options} height={200} />
}
