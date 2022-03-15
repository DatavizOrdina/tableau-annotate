import React from "react";
import { Button } from "react-bootstrap";
import "./styles/SheetList.css";

function TestBtnComponent(props) {
  return (
    <div>
      <Button
        key={props.btnValue}
        variant="light"
        block
        onClick={() => props.onClick(document.getElementById("myInput").value)}
      >
        {props.btnValue}
      </Button>
    </div>
  );
}

export default TestBtnComponent;
