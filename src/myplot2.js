import React, { useState, useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Scatter, Chart } from "react-chartjs-2";
ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend);

const ScatterPlot2 = ({ data, dataFit, width, height, label1, label2 }) => {
  function withChartSizeControl(Component) {
    return (props) => (
      <div
        className="chart"
        style={{
          position: "relative",
          height: props.height + "px",
          width: props.width + "px",
        }}
      >
        <Component {...props} />
      </div>
    );
  }

  const Scatter2 = withChartSizeControl(Chart);

  const options = {
    scales: {
      x: {
        beginAtZero: true,
      },
    },
  };

  const dt = {
    datasets: [
      {
        type: "scatter",
        label: label1,
        data: data,
        backgroundColor: "rgba(255, 99, 132, 1)",
      },
      {
        type: "line",
        label: label2,
        data: dataFit,
        backgroundColor: "rgba(132, 99, 255, 0.3)",
        showLine: true,
        pointRadius: 0,
        borderColor: "rgba(132, 99, 255, 0.3)",
      },
    ],
  };

  return (
    <div>
      <Scatter2
        type="Line"
        options={options}
        data={dt}
        height={height}
        width={width}
      />
    </div>
  );
};

export default ScatterPlot2;