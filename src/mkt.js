import React, { useState, useEffect } from "react";
import ScatterPlot from "./myplot";
import ScatterPlot2 from "./myplot2";
import { Row, Container, Col } from "react-bootstrap";
import { levenbergMarquardt } from "ml-levenberg-marquardt";
import { CSVLink } from "react-csv";
import "bootstrap/dist/css/bootstrap.min.css";

const Mkt = ({}) => {
  const [mainPlot, setMainPlot] = useState(<div></div>);

  const [gamma, setGamma] = useState(0.066);
  const [visco, setVisco] = useState(0.00037);
  const [T, setT] = useState(300.0);
  const [Ucrit, setUcrit] = useState(-24.33);
  const [k0, setK0] = useState(10.9e9);
  const [lambda, setLambda] = useState(5.0e-10);
  const [th0, setTh0] = useState(70.7);

  const [th, setTh] = useState([]);
  const [U, setU] = useState([]);
  const [data, setData] = useState([]);
  const [param, setParam] = useState([]);
  const [results, setResults] = useState([]);

  useEffect(() => {
    setGamma(localStorage.getItem("gamma"));
    setVisco(localStorage.getItem("visco"));
    setT(localStorage.getItem("T"));
    setUcrit(localStorage.getItem("Ucrit"));
    setK0(localStorage.getItem("k0"));
    setLambda(localStorage.getItem("lambda"));
    setTh0(localStorage.getItem("th0"));
  }, []);

  const kB = 1.38066e-23;

  function clickAndSave(label, value, selectFunction) {
    localStorage.setItem(label, value);
    selectFunction(value);
  }

  function CSVToArray(strData, strDelimiter) {
    strDelimiter = strDelimiter || ",";
    var objPattern = new RegExp(
      "(\\" +
        strDelimiter +
        "|\\r?\\n|\\r|^)" +
        '(?:"([^"]*(?:""[^"]*)*)"|' +
        '([^"\\' +
        strDelimiter +
        "\\r\\n]*))",
      "gi"
    );
    var arrData = [[]];
    var arrMatches = null;
    while ((arrMatches = objPattern.exec(strData))) {
      var strMatchedDelimiter = arrMatches[1];
      if (strMatchedDelimiter.length && strMatchedDelimiter !== strDelimiter) {
        arrData.push([]);
      }
      var strMatchedValue;
      if (arrMatches[2]) {
        strMatchedValue = arrMatches[2].replace(new RegExp('""', "g"), '"');
      } else {
        strMatchedValue = arrMatches[3];
      }
      arrData[arrData.length - 1].push(strMatchedValue);
    }
    return arrData;
  }

  function mktFunction([a, b, c]) {
    // a = 2*k0*lambda (m/s)
    // b = gamma*lambda^2/(2*kB*T) (adimensional)
    //c = th0 (rad)
    return (t) => a * Math.sinh(b * (Math.cos(c) - Math.cos(t)));
  }

  function fitMKT(t, u, k, l, t0) {
    // Fit MKT for U>0

    let xInput = [];
    let yInput = [];
    for (let i = 0; i < t.length; i++) {
      if (u[i] >= 0) {
        xInput.push(t[i]);
        yInput.push(u[i]);
      }
    }

    let a0 = 2 * k * l;
    let b0 = (gamma * l * l) / (2 * kB * T);
    let c0 = (t0 * Math.PI) / 180;

    let dat = { y: yInput, x: xInput.map((x) => (x * Math.PI) / 180) };
    let initialValues = [a0, b0, c0];

    const options = {
      damping: 1.1,
      initialValues: initialValues,
      gradientDifference: 10e-5,
      maxIterations: 1000,
      errorTolerance: 10e-5,
    };

    let fittedParams = levenbergMarquardt(dat, mktFunction, options);

    const sTh0 = (fittedParams.parameterValues[2] * 180) / Math.PI;
    const sLambda = Math.sqrt(
      (2 * kB * T * fittedParams.parameterValues[1]) / gamma
    );
    const sK0 = fittedParams.parameterValues[0] / (2 * sLambda);

    return { k0: sK0, lambda: sLambda, th0: sTh0 };
  }

  function iterative(th0, k0, lambda, U, th) {
    const thCrit = Math.acos(
      Math.cos((th0 * Math.PI) / 180) -
        ((2 * kB * T) / (gamma * lambda * lambda)) *
          Math.log(
            Ucrit / (2 * k0 * lambda) +
              Math.sqrt(Math.pow(Ucrit / (2 * k0 * lambda), 2) + 1)
          )
    );

    const LLm = Math.exp(
      Math.pow(thCrit, 3) / ((9 * (-Ucrit * visco)) / gamma)
    );
    let thMicro = [];
    for (let i = 0; i < U.length; i++) {
      thMicro.push(
        (180 / Math.PI) *
          Math.pow(
            Math.pow((th[i] * Math.PI) / 180, 3) -
              ((9 * U[i] * visco) / gamma) * Math.log(LLm),
            1 / 3
          )
      );
    }

    const res = { thCrit: thCrit, LLm: LLm, thMicro: thMicro };
    return res;
  }

  function method(th, U) {
    const maxIter = 200;
    let sk0 = [];
    let sLambda = [];
    let sTh0 = [];
    let sLLm = [];
    let sThCrit = [];
    let sThMicro = [];
    let sThMacro = [];
    let sUmicro = [];
    let sIter = [];
    let myParam = [["iter", "L/Lm", "thCrit", "k0", "lambda", "th0"]];

    let resMKT = fitMKT(th, U, k0, lambda, th0);

    let thMicro = JSON.parse(JSON.stringify(th));
    let LLmOld = 0;
    let done = true;

    let niter = 1;
    for (let i = 0; i < maxIter; i++) {
      const resIterative = iterative(
        resMKT.th0,
        resMKT.k0,
        resMKT.lambda,
        U,
        th
      );
      thMicro = resIterative.thMicro;

      resMKT = fitMKT(thMicro, U, resMKT.k0, resMKT.lambda, resMKT.th0);

      LLmOld = resIterative.LLm;

      sLLm.push(resIterative.LLm);
      sThCrit.push(resIterative.thCrit);
      sk0.push(resMKT.k0);
      sLambda.push(resMKT.lambda);
      sTh0.push(resMKT.th0);
      sIter.push(niter);
      myParam.push([
        niter,
        resIterative.LLm,
        resIterative.thCrit,
        resMKT.k0,
        resMKT.lambda,
        resMKT.th0,
      ]);
      niter += 1;
      if (done && i > 2 && Math.abs(LLmOld - resIterative.LLm) < 1e-4) {
        i = maxIter - 5;
        done = false;
      }
    }

    setParam(myParam);

    const npoints = 1000;
    const thCritFinal = 0 * sThCrit[sThCrit.length - 1];
    const stepTh = (Math.PI - thCritFinal) / npoints;
    const k0Final = sk0[sk0.length - 1];
    const lambdaFinal = sLambda[sLambda.length - 1];
    const th0Final = sTh0[sTh0.length - 1];
    const LLmFinal = sLLm[sLLm.length - 1];

    for (let i = 0; i < npoints; i++) {
      const uu =
        2 *
        k0Final *
        lambdaFinal *
        Math.sinh(
          (gamma *
            lambdaFinal *
            lambdaFinal *
            (Math.cos((th0Final * Math.PI) / 180) -
              Math.cos(thCritFinal + i * stepTh))) /
            (2 * kB * T)
        );
      sUmicro.push(uu);
      sThMicro.push(((thCritFinal + i * stepTh) * 180) / Math.PI);
      sThMacro.push(
        (180 / Math.PI) *
          Math.pow(
            Math.pow(thCritFinal + i * stepTh, 3) +
              ((9 * uu * visco) / gamma) * Math.log(LLmFinal),
            1 / 3
          )
      );
    }

    let myResults = [["U", "Angle_micro", "Angle_macro"]];
    for (let i = 0; i < sUmicro.length; i++) {
      myResults.push([sUmicro[i], sThMicro[i], sThMacro[i]]);
    }
    setResults(myResults);

    return {
      iter: sIter,
      k0: sk0,
      lambda: sLambda,
      th0: sTh0,
      LLm: sLLm,
      thCrit: sThCrit,
      uMicro: sUmicro,
      thMicro: sThMicro,
      thMacro: sThMacro,
    };
  }

  function compute() {
    alert("Vamos de nuevo");
    const final = method(th, U);
    let dataMicro = [];
    for (let i = 0; i < final.uMicro.length; i++) {
      dataMicro.push([final.uMicro[i], final.thMicro[i]]);
    }

    let dataMacro = [];
    for (let i = 0; i < final.uMicro.length; i++) {
      dataMacro.push([final.uMicro[i], final.thMacro[i]]);
    }

    let dataLLm = [];
    for (let i = 0; i < final.iter.length; i++) {
      dataLLm.push([final.iter[i], final.LLm[i]]);
    }

    let dataK0 = [];
    for (let i = 0; i < final.iter.length; i++) {
      dataK0.push([final.iter[i], final.k0[i] * 1e-9]);
    }

    let dataLambda = [];
    for (let i = 0; i < final.iter.length; i++) {
      dataLambda.push([final.iter[i], final.lambda[i] * 1e9]);
    }

    const x0 = (
      <ScatterPlot
        data={data}
        dataFit={dataMicro}
        dataFit2={dataMacro}
        width={430}
        height={600}
      />
    );

    const x1 = (
      <ScatterPlot2
        data={dataLLm}
        dataFit={[
          [0, dataLLm[dataLLm.length - 1][1]],
          [dataLLm[dataLLm.length - 1][0], dataLLm[dataLLm.length - 1][1]],
        ]}
        width={300}
        height={200}
        label1={"L/Lm"}
        label2={"Convergence"}
      />
    );
    const x2 = (
      <ScatterPlot2
        data={dataK0}
        dataFit={[
          [0, dataK0[dataK0.length - 1][1]],
          [dataK0[dataK0.length - 1][0], dataK0[dataLLm.length - 1][1]],
        ]}
        width={300}
        height={200}
        label1={"k0 (GHz)"}
        label2={"Convergence"}
      />
    );
    const x3 = (
      <ScatterPlot2
        data={dataLambda}
        dataFit={[
          [0, dataLambda[dataLambda.length - 1][1]],
          [
            dataLambda[dataLambda.length - 1][0],
            dataLambda[dataLambda.length - 1][1],
          ],
        ]}
        width={300}
        height={200}
        label1={"Lambda (nm)"}
        label2={"Convergence"}
      />
    );

    setMainPlot(
      <div>
        <Row>
          <Col>{x0}</Col>
          <Col>
            <Row>{x1}</Row>
            <Row>{x2}</Row>
            <Row>{x3}</Row>
          </Col>
        </Row>
      </div>
    );

    // graphMKT(data, dataMicro, dataMacro);
  }

  const readFile = async (e) => {
    e.preventDefault();
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;

      const data = CSVToArray(text, ",");
      let U = [];
      let th = [];

      for (const x of data.slice(1)) {
        U.push(parseFloat(x[0]));
        th.push(parseFloat(x[1]));
      }
      setU(U);
      setTh(th);
      setData(data);

      // const final = method(th, U);
      // let dataMicro = [];
      // for (let i = 0; i < final.uMicro.length; i++) {
      //   dataMicro.push([final.uMicro[i], final.thMicro[i]]);
      // }

      // let dataMacro = [];
      // for (let i = 0; i < final.uMicro.length; i++) {
      //   dataMacro.push([final.uMicro[i], final.thMacro[i]]);
      // }

      // graphMKT(data, dataMicro, dataMacro);
    };
    reader.readAsText(e.target.files[0]);
  };

  function control() {
    const x = (
      <Container className="myContainer">
        <Row>
          <label>Surface tension (N/m) </label>

          <input
            className="mytext"
            type="text"
            value={gamma}
            onChange={(e) => clickAndSave("gamma", e.target.value, setGamma)}
          />
        </Row>
        <Row>
          <label> Viscosity (Pa.s) </label>
          <input
            className="mytext"
            type="text"
            value={visco}
            onChange={(e) => clickAndSave("visco", e.target.value, setVisco)}
          />
        </Row>
        <Row>
          <label> T (K) </label>
          <input
            className="mytext"
            type="text"
            value={T}
            onChange={(e) => clickAndSave("T", e.target.value, setT)}
          />
        </Row>
        <Row>
          {" "}
          <label> Ucrit (m/s)</label>
          <input
            className="mytext"
            type="text"
            value={Ucrit}
            onChange={(e) => clickAndSave("Ucrit", e.target.value, setUcrit)}
          />
        </Row>
        <Row>
          <label> k0 (Hz) </label>
          <input
            className="mytext"
            type="text"
            value={k0}
            onChange={(e) => clickAndSave("k0", e.target.value, setK0)}
          />
        </Row>
        <Row>
          <label> Lambda (m) </label>
          <input
            className="mytext"
            type="text"
            value={lambda}
            onChange={(e) => clickAndSave("lambda", e.target.value, setLambda)}
          />
        </Row>
        <Row>
          <label> th0 (deg) </label>
          <input
            className="mytext"
            type="text"
            value={th0}
            onChange={(e) => clickAndSave("th0", e.target.value, setTh0)}
          />
        </Row>
        <Row>Load csv file: velocity,angle</Row>
        <Row>
          <input
            type="file"
            id="file-selector"
            accept=".csv"
            onChange={(e) => readFile(e)}
          ></input>
        </Row>
        <Row>{"Execute"} </Row>
        <Row>
          <button onClick={compute}>Compute</button>
        </Row>
        <Row>{"Save files"} </Row>
      </Container>
    );
    return x;
  }

  return (
    <div>
      <Container>
        <Row>
          <Col xs lg="3" className="myContainer">
            {control()}
          </Col>
          <Col>{mainPlot}</Col>
        </Row>
        <Row>
          <CSVLink data={param} filename={"parameters.csv"}>
            Download parameters
          </CSVLink>
        </Row>
        <Row>
          <CSVLink data={results} filename={"vel_angles.csv"}>
            Download angles/velocities
          </CSVLink>
        </Row>
      </Container>
    </div>
  );
};

export default Mkt;
