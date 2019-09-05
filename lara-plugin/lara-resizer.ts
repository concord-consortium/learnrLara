import iframePhone from "iframe-phone";

// iframes can either be a single iframe node via document.getElementById(...) or a list of nodes via document.getElementsByClassName(...)
export const init = (iframes) => {
  if (iframes.length) {
    for (var i = 0; i < iframes.length; i++) {
      listenForHeightChange(iframes[i]);
    }
  }
  else {
    listenForHeightChange(iframes);
  }
};

const listenForHeightChange = (iframe) => {
  const phone = iframePhone.ParentEndpoint(iframe);
  phone.addListener("height", (height) => {
    iframe.height = height;
  });
}
