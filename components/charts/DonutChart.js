'use client'
import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

export default function DonutChart({ data, labels, colors }) {
  const hasData = data && data.some(d => d > 0)
  if (!hasData) return <div className="text-center py-8 text-gray-400">No data</div>

  const chartData = {
    labels,
    datasets: [{
      data,
      backgroundColor: colors.map(c => c + 'cc'),
      borderColor: colors,
      borderWidth: 2,
      hoverOffset: 6
    }]
  }

  const options = {
    responsive: true,
    cutout: '65%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { font: { size: 12 }, padding: 16, usePointStyle: true, pointStyleWidth: 8 }
      },
      tooltip: {
        callbacks: {
          label: ctx => ` ${ctx.label}: ${ctx.raw} (${((ctx.raw / data.reduce((a, b) => a + b, 0)) * 100).toFixed(1)}%)`
        }
      }
    }
  }

  return <Doughnut data={chartData} options={options} />
}
