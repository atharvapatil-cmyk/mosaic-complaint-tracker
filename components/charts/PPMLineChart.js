'use client'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

function getPPMColor(ppm) {
  if (ppm >= 10000) return '#dc2626'
  if (ppm >= 5000) return '#ea580c'
  if (ppm >= 1000) return '#ca8a04'
  return '#16a34a'
}

export default function PPMLineChart({ ppmData }) {
  if (!ppmData || ppmData.length === 0) {
    return <div className="text-center py-8 text-gray-400">No PPM data</div>
  }

  const labels = ppmData.map((d, i) =>
    (d.product || d.selectProduct || `Product ${i + 1}`).slice(0, 20)
  )

  const data = {
    labels,
    datasets: [{
      label: 'PPM',
      data: ppmData.map(d => d.ppm || 0),
      backgroundColor: ppmData.map(d => getPPMColor(d.ppm || 0) + 'bb'),
      borderColor: ppmData.map(d => getPPMColor(d.ppm || 0)),
      borderWidth: 1.5,
      borderRadius: 6,
    }]
  }

  const options = {
    indexAxis: 'y',
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const item = ppmData[ctx.dataIndex]
            return [
              ` PPM: ${ctx.raw.toLocaleString()}`,
              ` Complaints: ${item.complaints}`,
              ` Units Sold: ${item.unitsSold.toLocaleString()}`
            ]
          }
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: '#f3f4f6' },
        ticks: { font: { size: 11 } }
      },
      y: {
        grid: { display: false },
        ticks: { font: { size: 11 } }
      }
    }
  }

  return <Bar data={data} options={options} />
}
