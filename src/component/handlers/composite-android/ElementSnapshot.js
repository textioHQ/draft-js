// See https://github.com/ianstormtaylor/slate/pull/2565/files#diff-dfb45b3faad4511630e8699d68f62ee9R23

function isTextNode(node) {
  return node.type === Node.TEXT_NODE;
}

function getElementSnapshot(node) {
  const snapshot = {};
  snapshot.node = node;
  if (isTextNode(node)) {
    snapshot.text = node.textContent;
  }
  snapshot.children = Array.from(node.childNodes).map(getElementSnapshot);
  return snapshot;
}

function applyElementSnapshot(snapshot) {
  const node = snapshot.node;
  if (isTextNode(node)) {
    node.textContent = snapshot.text;
  } else {
    snapshot.children.forEach(child => {
      applyElementSnapshot(child);
      node.appendChild(child.node);
    });
    while (node.childNodes.length > snapshot.children.length) {
      node.removeChild(node.childNodes[0]);
    }
  }
}

function getSnapshot(elements = []) {
  const last = elements[elements.length - 1];
  return {
    elements: elements.map(getElementSnapshot),
    parent: last.parentElement,
    next: last.nextElementSibling,
  };
}

function applySnapshot(snapshot) {
  const { elements, parent, next } = snapshot;
  elements.forEach(applyElementSnapshot);
  const last = elements[elements.length - 1];

  if (next) {
    parent.insertBefore(last.node, next);
  } else {
    parent.appendChild(last.node);
  }

  let prev = last.node;
  elements
    .slice(-1)
    .reverse()
    .forEach(({ node }) => {
      parent.insertBefore(node, prev);
      prev = node;
    });
}

class ElementSnapshot {
  constructor(elements) {
    this.snapshot = getSnapshot(elements);
  }

  apply() {
    applySnapshot(this.snapshot);
  }
}

module.exports = ElementSnapshot;
