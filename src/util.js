// attachEvent(domElement, "click", this.myfunction.bind(this));
export const attachEvent = () => {
  if (element && eventName && element.getAttribute("listener") !== "true") {
    element.setAttribute("listener", "true");
    element.addEventListener(eventName, () => {
      callback();
    });
  }
};

// detachEvent(domElement, "click", this.myfunction);
export const detachEvent = () => {
  if (eventName && element) {
    element.removeEventListener(eventName, callback);
  }
};
