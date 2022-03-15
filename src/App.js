import React, { useEffect, useState } from "react";
import { Button, Modal } from "react-bootstrap";
import LoadingIndicatorComponent from "./LoadingIndicatorComponent";
import SheetListComponent from "./SheetListComponent";
import TestBtnComponent from "./TestBtnComponent";
import "./styles/Main.css";

// Declare this so our linter knows that tableau is a global object
/* global tableau */

function MainComponent() {
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSheet, setSelectedSheet] = useState(undefined);
  const [sheetNames, setSheetNames] = useState([]);
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [dataKey, setDataKey] = useState(1);
  const [filteredFields, setFilteredFields] = useState([]);
  const [dashboardName, setDashboardName] = useState("");
  const [data, setData] = useState([]);
  const [printData, setPrintData] = useState([]);

  let unregisterEventFn;

  useEffect(() => {
    let datas = "";
    fetch("http://localhost:7071/api/countries")
      .then((response) => {
        return response.json();
      })
      .then((myJson) => {
        console.log(myJson);
        for (const x of myJson) {
          datas = x;
          let tmp = data;
          let json = {
            State: datas.State,
            value: datas.Value,
          };
          tmp.push(json);
          setData(tmp);
        }
      });
  }, []);

  useEffect(() => {
    tableau.extensions.initializeAsync().then(() => {
      const selectedSheet = tableau.extensions.settings.get("sheet");
      setSelectedSheet(selectedSheet);

      const sheetNames =
        tableau.extensions.dashboardContent.dashboard.worksheets.map(
          (worksheet) => worksheet.name
        );
      setSheetNames(sheetNames);

      const dashboardName = tableau.extensions.dashboardContent.dashboard.name;
      setDashboardName(dashboardName);

      const sheetSelected = !!selectedSheet;
      setIsLoading(sheetSelected);

      if (selectedSheet) {
        loadSelectedMarks(selectedSheet);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getSelectedSheet = (sheet) => {
    const sheetName = sheet || selectedSheet;
    return tableau.extensions.dashboardContent.dashboard.worksheets.find(
      (worksheet) => worksheet.name === sheetName
    );
  };

  const onSelectSheet = (sheet) => {
    tableau.extensions.settings.set("sheet", sheet);
    setIsLoading(true);
    tableau.extensions.settings.saveAsync().then(() => {
      setSelectedSheet(sheet);
      setFilteredFields([]);
      loadSelectedMarks(sheet);
    });
  };

  const loadSelectedMarks = (sheet) => {
    if (unregisterEventFn) {
      unregisterEventFn();
    }

    const worksheet = getSelectedSheet(sheet);
    worksheet.getSelectedMarksAsync().then((marks) => {
      // Get the first DataTable for our selected marks (usually there is just one)
      const worksheetData = marks.data[0];

      // Map our data into the format which the data table component expects it
      const rows = worksheetData.data.map((row) =>
        row.map((cell) => cell.formattedValue)
      );

      const headers = worksheetData.columns.map((column) => column.fieldName);

      // Get key of selection (state)
      // Load all values of rows with key

      let outData = [];
      rows.forEach((d) => {
        data.forEach((a) => {
          var states = a.State.split("|");
          if (states.includes(d[0])) outData.push(a);
          // if (a.State === d[0]) {
          //   outData.push(a);
          // }
        });
      });

      if (rows.length === 0) outData = data;

      // make unique
      outData = [...new Set(outData)];

      setPrintData(outData);
      setDataKey(Date.now());
      setIsLoading(false);
      renderViz();
    });

    unregisterEventFn = worksheet.addEventListener(
      tableau.TableauEventType.MarkSelectionChanged,
      () => {
        // setIsLoading(true);
        loadSelectedMarks(sheet);
      }
    );
  };

  const onResetFilters = () => {
    const worksheet = getSelectedSheet();
    // setIsLoading(true);
    const promises = filteredFields.map((fieldName) =>
      worksheet.clearFilterAsync(fieldName)
    );
    Promise.all(promises).then(() => {
      setFilteredFields([]);
      setIsLoading(false);
    });
  };

  const selectMarks = (states) => {
    const worksheet = getSelectedSheet();
    var statesFormatted = states.split("|");

    worksheet.selectMarksByValueAsync(
      [
        {
          fieldName: "State",
          value: statesFormatted,
        },
      ],
      tableau.SelectionUpdateType.Replace
    );
  };

  const deSelectMarks = () => {
    const worksheet = getSelectedSheet();
    worksheet.clearSelectedMarksAsync().then(function () {
      console.log("Your marks selection has been cleared!");
    });
  };

  const mainContent = (
    <div>
      <div style={{ position: "relative", float: "left" }}>
        {printData.map((d, key) => {
          return (
            <div
              id={"row" + key}
              class="row"
              onClick={() => selectMarks(d.State)}
            >
              <p style={{ paddingLeft: "20px" }}>
                {d.State}: {d.value}
              </p>
            </div>
          );
        })}
      </div>
      <div
        id="viz-container"
        style={{ position: "relative", float: "right" }}
      ></div>
    </div>
  );

  // This function creates and displays a viz image.
  function addVizImage(markType, palette) {
    // Building the input specification object that is used to create the viz image.
    // Data values used in the viz image are prefilled.

    let splitArray = [];
    data.forEach((d) => {
      var states = d.State.split("|");
      states.forEach((State) => {
        let obj = {
          State: State,
        };
        splitArray.push(obj);
      });
    });

    var result = [];
    splitArray.reduce(function (res, value) {
      if (!res[value.State]) {
        res[value.State] = { State: value.State, cnt: 0 };
        result.push(res[value.State]);
      }
      res[value.State].cnt += 1;
      return res;
    }, {});

    const vizInputSpec = {
      description: "A sample viz", // optional parameter.
      size: { width: 400, height: 300 },
      data: {
        values: result,
      },
      mark: markType,
      markcolor: "#FFED5F", // may not get used in viz if color is encoded in viz.
      encoding: {
        columns: {
          field: "State",
          type: tableau.VizImageEncodingType.Discrete,
        },
        rows: { field: "cnt", type: tableau.VizImageEncodingType.Continuous },
        color: {
          field: "cnt",
          type: tableau.VizImageEncodingType.Discrete,
          palette,
        },
      },
    };

    // defaulting values if null.
    if (markType === null) {
      vizInputSpec.mark = tableau.MarkType.Bar;
    }
    if (palette === null) {
      vizInputSpec.encoding.color.palette = "tableau20_10_0";
    }

    // making call to create viz image from the input specifications.
    tableau.extensions.createVizImageAsync(vizInputSpec).then(
      function (svg) {
        const blob = new Blob([svg], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const image = document.createElement("img");
        image.src = url;
        image.style.maxWidth = "100%";
        image.style.maxHeight = "100%";
        image.className = "center-block";
        const vizApiElement = document.getElementById("viz-container");
        // clearing UI and adding in new viz.
        vizApiElement.innerHTML = "";
        vizApiElement.appendChild(image);
        image.addEventListener(
          "load",
          function () {
            return URL.revokeObjectURL(url);
          },
          { once: true }
        );
      },
      function (err) {
        console.log(err);
      }
    );
  }

  const onClickTestBtn = (value) => {
    if (value) {
      const worksheet = getSelectedSheet();
      setIsLoading(false);
      worksheet.getSelectedMarksAsync().then((marks) => {
        // Get the first DataTable for our selected marks (usually there is just one)
        const worksheetData = marks.data[0];

        // Map our data into the format which the data table component expects it
        const rows = worksheetData.data.map((row) =>
          row.map((cell) => cell.formattedValue)
        );

        if (rows.length === 0) return;

        const headers = worksheetData.columns.map((column) => column.fieldName);

        const keys = headers;
        const values = rows;

        let merged = [];
        values.forEach((d) => {
          merged.push(
            keys.reduce((obj, key, index) => ({ ...obj, [key]: d[index] }), {})
          );
        });

        let marksData = marks.data[0];
        marksData = marksData.data.map((d) =>
          d.map((cell) => cell.formattedValue)
        );

        let inputValue = document.getElementById("myInput").value;

        let tmp = data;
        let state = "";
        marksData.forEach((d, i) => {
          state = i === 0 ? d[0] : `${state}|${d[0]}`;
        });

        tmp.push({ State: state, value: inputValue });
        let json = {
          state: state,
          value: inputValue,
        };
        fetch("http://localhost:7071/api/countries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(json),
        }).then((res) => {
          console.log("Request complete! response:", res);
          document.getElementById("myInput").value = "";
        });
        setData(tmp);
      });
      //push to DB
      //setApiData(tmp)
      setIsLoading(false);
      loadSelectedMarks();
    }
  };

  const onClickDeleteBtn = (value) => {
    if (value) {
      const worksheet = getSelectedSheet();
      setIsLoading(false);
      worksheet.getSelectedMarksAsync().then((marks) => {
        // Get the first DataTable for our selected marks (usually there is just one)
        const worksheetData = marks.data[0];

        // Map our data into the format which the data table component expects it
        const rows = worksheetData.data.map((row) =>
          row.map((cell) => cell.formattedValue)
        );

        if (rows.length === 0) return;

        const headers = worksheetData.columns.map((column) => column.fieldName);

        const keys = headers;
        const values = rows;

        let merged = [];
        values.forEach((d) => {
          merged.push(
            keys.reduce((obj, key, index) => ({ ...obj, [key]: d[index] }), {})
          );
        });

        let marksData = marks.data[0];
        marksData = marksData.data.map((d) =>
          d.map((cell) => cell.formattedValue)
        );

        let inputValue = document.getElementById("myInput").value;

        let state = "";
        marksData.forEach((d, i) => {
          state = i === 0 ? d[0] : `${state}|${d[0]}`;
        });
        let tmp = data;
        var index = data.indexOf(inputValue);
        tmp.splice(index, 1);
        setData(tmp);
        let theUrl = "http://localhost:7071/api/countries";
        let json = {
          State: state,
          Value: inputValue,
        };
        let query = Object.keys(json)
          .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(json[k]))
          .join("&");
        let url = theUrl + "?" + query;
        fetch(url, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        })
          .then((data) => data.text())
          .then((text) => {
            document.getElementById("myInput").value = "";
          })
          .catch(function (error) {
            alert("request failed", error);
          });
        //
      });
      setIsLoading(false);
      loadSelectedMarks();
    }
  };

  const renderViz = () => {
    addVizImage("bar", "tableau20_10_0");
  };

  let output = (
    <div>
      <div className="summary_header">
        <h4>
          Marks for <span className="sheet_name">{selectedSheet}</span>
          <Button variant="link" onClick={() => setSelectedSheet(undefined)}>
            <img className="icon" src="./setting.svg" alt="" />
          </Button>
          <Button
            variant="link"
            onClick={onResetFilters}
            disabled={filteredFields.length === 0}
          >
            <img className="icon" src="./undo-arrow.svg" alt="" />
          </Button>
        </h4>
        <div style={{ display: "inline", float: "left" }}>
          <input type="text" id="myInput" />
        </div>
        <div style={{ display: "inline", float: "left" }}>
          <TestBtnComponent
            btnValue="Click me to insert"
            onClick={onClickTestBtn}
          />
        </div>
        <div style={{ display: "inline", float: "left" }}>
          <TestBtnComponent
            btnValue="Click me to clear selection"
            onClick={deSelectMarks}
          />
        </div>
        <div style={{ display: "inline", float: "left" }}>
          <TestBtnComponent
            btnValue="Click me to render viz"
            onClick={renderViz}
          />
        </div>
        <div style={{ display: "inline", float: "left" }}>
          <TestBtnComponent
            btnValue="Click me to delete state with given value"
            onClick={onClickDeleteBtn}
          />
        </div>
        {/* <input type="text" id="myInput2" style={{ float: "left" }} />
        <TestBtnComponent
          btnValue="Click  to update"
          onClick={onClickUpdateBtn}
          style={{ float: "left" }}
        /> */}
      </div>
      {mainContent}
    </div>
  );

  if (isLoading) {
    output = <LoadingIndicatorComponent msg="Loading" />;
  }

  if (!selectedSheet) {
    output = (
      <Modal show>
        <Modal.Header>
          <Modal.Title>
            Choose a Sheet from{" "}
            <span className="sheet_name">{dashboardName}</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <SheetListComponent
            sheetNames={sheetNames}
            onSelectSheet={onSelectSheet}
          />
        </Modal.Body>
      </Modal>
    );
  }

  return <>{output}</>;
}

export default MainComponent;
