import React, { useEffect, useState } from "react";
import { Button, Modal } from "react-bootstrap";
import SheetListComponent from "./SheetListComponent";
import TestBtnComponent from "./TestBtnComponent";
import "./styles/Main.css";

// Usefull link: https://nerdyandnoisy.com/building-your-first-tableau-extension/

// Declare this so our linter knows that tableau is a global object
/* global tableau */

function MainComponent() {
  const [selectedSheet, setSelectedSheet] = useState(undefined);
  const [sheetNames, setSheetNames] = useState([]);
  const [dashboardName, setDashboardName] = useState("");

  const [data, setData] = useState([]);
  const [printData, setPrintData] = useState([]);

  let unregisterEventFn;

  ///////////////////////////////////////////////////////////////////////////
  // INIT FUNCTIONS                                                        //
  ///////////////////////////////////////////////////////////////////////////

  // Load all existing comments on initialization:
  useEffect(() => {
    fetch("https://oscarsapi.azurewebsites.net/api/countries")
      .then((response) => {
        return response.json();
      })
      .then((myJson) => {
        for (const x of myJson) {
          let json = {
            State: x.State,
            value: x.Value,
          };
          data.push(json);
          setData(data);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Code that needs to be executed post the extension initialization
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

      // !! converts Object to boolean. If it was falsey (e.g. 0, null, undefined, etc.), it will be false, otherwise, true.
      const sheetSelected = !!selectedSheet;
      if (sheetSelected) {
        loadSelectedMarks(selectedSheet);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  ///////////////////////////////////////////////////////////////////////////
  // CLICK EVENTS                                                          //
  ///////////////////////////////////////////////////////////////////////////

  // On select sheet store the sheet in the settings, so the user does not get the prompt every time.
  const onSelectSheet = (sheet) => {
    tableau.extensions.settings.set("sheet", sheet);
    tableau.extensions.settings.saveAsync().then(() => {
      setSelectedSheet(sheet);
      loadSelectedMarks(sheet);
    });
  };

  const onClickInsertBtn = () => {
    let value = document.getElementById("myInput").value;
    if (value) {
      const worksheet = getSelectedSheet();
      worksheet.getSelectedMarksAsync().then((marks) => {
        let marksData = getTableauMarksData(marks);
        if (marksData.length === 0) return;

        let json = {
          State: getStatesFromSelectedMarks(marksData),
          value: value,
        };

        fetch("https://oscarsapi.azurewebsites.net/api/countries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(json),
        }).then((res) => {
          console.log("Request complete! response:", res);
        });

        data.push(json);
        document.getElementById("myInput").value = "";
        setData(data);
      });
      loadSelectedMarks();
    }
  };

  const onClickDeleteBtn = () => {
    let value = document.getElementById("myInput").value;
    if (value) {
      const worksheet = getSelectedSheet();
      worksheet.getSelectedMarksAsync().then((marks) => {
        let marksData = getTableauMarksData(marks);
        if (marksData.length === 0) return;

        let tmp = data;
        var index = data.indexOf(value);
        tmp.splice(index, 1);
        setData(tmp);
        let theUrl = "https://oscarsapi.azurewebsites.net/api/countries";
        let json = {
          State: getStatesFromSelectedMarks(marksData),
          value: value,
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
      loadSelectedMarks();
    }
  };

  const deSelectMarks = () => {
    const worksheet = getSelectedSheet();
    worksheet.clearSelectedMarksAsync().then(function () {
      console.log("Your marks selection has been cleared!");
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

  const renderViz = () => {
    addVizImage("bar", "tableau20_10_0");
  };

  ///////////////////////////////////////////////////////////////////////////
  // HELPER FUNCTIONS                                                      //
  ///////////////////////////////////////////////////////////////////////////

  const loadSelectedMarks = (sheet) => {
    if (unregisterEventFn) {
      unregisterEventFn();
    }
    const worksheet = getSelectedSheet(sheet);
    worksheet.getSelectedMarksAsync().then((marks) => {
      let marksData = getTableauMarksData(marks);
      let parsedMarksData = parseTableauMarksData(marksData);
      setPrintData(parsedMarksData);
      renderViz();
    });
    unregisterEventFn = worksheet.addEventListener(
      tableau.TableauEventType.MarkSelectionChanged,
      () => {
        loadSelectedMarks(sheet);
      }
    );
  };

  const getTableauMarksData = (marks) => {
    let marksData = marks.data[0].data.map((d) =>
      d.map((cell) => cell.formattedValue)
    );
    return marksData;
  };

  const parseTableauMarksData = (marks) => {
    let outData = [];
    marks.forEach((d) => {
      data.forEach((a) => {
        var states = a.State.split("|");
        if (states.includes(d[0])) outData.push(a);
      });
    });
    if (marks.length === 0) outData = data; // when no marks selected, show all marks
    outData = [...new Set(outData)]; // make unique
    return outData;
  };

  const getStatesFromSelectedMarks = (marksData) => {
    let state = "";
    marksData.forEach((d, i) => {
      state = i === 0 ? d[0] : `${state}|${d[0]}`;
    });
    return state;
  };

  const getSelectedSheet = (sheet) => {
    const sheetName = sheet || selectedSheet;
    return tableau.extensions.dashboardContent.dashboard.worksheets.find(
      (worksheet) => worksheet.name === sheetName
    );
  };

  ///////////////////////////////////////////////////////////////////////////
  // FUNCTIONS RELATED TO RENDERING TABLEAU VIZ                            //
  ///////////////////////////////////////////////////////////////////////////

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

  ///////////////////////////////////////////////////////////////////////////
  // JSX                                                                   //
  ///////////////////////////////////////////////////////////////////////////

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

  let output = (
    <div>
      <div className="summary_header">
        <h4>
          Marks for <span className="sheet_name">{selectedSheet}</span>
          <Button variant="link" onClick={() => setSelectedSheet(undefined)}>
            <img className="icon" src="./setting.svg" alt="" />
          </Button>
        </h4>
        <div style={{ display: "inline", float: "left" }}>
          <input type="text" id="myInput" />
        </div>
        <div style={{ display: "inline", float: "left" }}>
          <TestBtnComponent
            btnValue="Click me to insert"
            onClick={onClickInsertBtn}
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
      </div>
      {mainContent}
    </div>
  );

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
