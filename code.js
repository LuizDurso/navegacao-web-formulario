// === Navegação Web por Teclado — código principal (roda na sandbox do Figma) ===

figma.showUI(__html__, { width: 420, height: 392 });

// --- Util: lista frames da página (recursivo, inclui dentro de Sections/Groups) ---
function getFrames() {
  const frames = figma.currentPage.findAllWithCriteria({ types: ["FRAME"] });
  return frames.map(n => ({ id: n.id, name: n.name, depth: getDepth(n) }));
}

function getDepth(node) {
  let depth = 0;
  let parent = node.parent;
  while (parent && parent.type !== "PAGE") {
    depth++;
    parent = parent.parent;
  }
  return depth;
}

function getSelectedFrames() {
  return figma.currentPage.selection
    .filter(n => n.type === "FRAME")
    .map(n => ({ id: n.id, name: n.name }));
}

// --- Transições ---
function buildTransition(type) {
  if (!type || type === "NONE") return null;
  const t = {
    DISSOLVE: { type: "DISSOLVE", easing: { type: "EASE_OUT" }, duration: 0.3 },
    SMART_ANIMATE: { type: "SMART_ANIMATE", easing: { type: "EASE_IN_AND_OUT" }, duration: 0.3 },
    SLIDE_FROM_RIGHT: { type: "MOVE_IN", direction: "LEFT", matchLayers: false, easing: { type: "EASE_OUT" }, duration: 0.3 },
    SLIDE_FROM_LEFT:  { type: "MOVE_IN", direction: "RIGHT", matchLayers: false, easing: { type: "EASE_OUT" }, duration: 0.3 },
    PUSH_FROM_RIGHT:  { type: "PUSH", direction: "LEFT", matchLayers: false, easing: { type: "EASE_OUT" }, duration: 0.3 },
    PUSH_FROM_LEFT:   { type: "PUSH", direction: "RIGHT", matchLayers: false, easing: { type: "EASE_OUT" }, duration: 0.3 },
  };
  return t[type] || null;
}

// --- Mensagens da UI ---
figma.ui.onmessage = async (msg) => {
  if (msg.type === "GET_FRAMES") {
    figma.ui.postMessage({
      type: "FRAMES_LIST",
      frames: getFrames(),
      selected: getSelectedFrames(),
    });
    return;
  }

  if (msg.type === "APPLY_INTERACTIONS") {
    try {
      const { sourceId, destinationId, keyCodes, transition } = msg;

      const sourceNode = await figma.getNodeByIdAsync(sourceId);
      if (!sourceNode || sourceNode.type !== "FRAME") {
        figma.ui.postMessage({ type: "ERROR", message: "Frame de origem não encontrado." });
        return;
      }
      const destNode = await figma.getNodeByIdAsync(destinationId);
      if (!destNode || destNode.type !== "FRAME") {
        figma.ui.postMessage({ type: "ERROR", message: "Frame de destino não encontrado." });
        return;
      }

      const transitionObj = buildTransition(transition);

      // Uma reaction por keyCode (Figma exige um keyCode por trigger ON_KEY_DOWN)
      const newReactions = keyCodes.map(code => ({
        trigger: { type: "ON_KEY_DOWN", device: "KEYBOARD", keyCodes: [code] },
        actions: [{
          type: "NODE",
          destinationId: destinationId,
          navigation: "NAVIGATE",
          transition: transitionObj,
          preserveScrollPosition: false,
          resetVideoPosition: false,
        }],
      }));

      // Preserva reactions que NÃO são de teclado (clicks, hover, etc.)
      const existing = sourceNode.reactions || [];
      const keptNonKey = existing.filter(r => r.trigger && r.trigger.type !== "ON_KEY_DOWN");

      await sourceNode.setReactionsAsync([...keptNonKey, ...newReactions]);

      figma.ui.postMessage({
        type: "SUCCESS",
        message: newReactions.length + ' interações de teclado aplicadas em "' +
                 sourceNode.name + '" -> "' + destNode.name + '".',
      });
    } catch (err) {
      figma.ui.postMessage({ type: "ERROR", message: "Erro ao aplicar: " + err.message });
    }
    return;
  }

  if (msg.type === "CLEAR_KEY_INTERACTIONS") {
    try {
      const sourceNode = await figma.getNodeByIdAsync(msg.sourceId);
      if (!sourceNode || sourceNode.type !== "FRAME") {
        figma.ui.postMessage({ type: "ERROR", message: "Frame não encontrado." });
        return;
      }
      const existing = sourceNode.reactions || [];
      await sourceNode.setReactionsAsync(
        existing.filter(r => r.trigger && r.trigger.type !== "ON_KEY_DOWN")
      );
      figma.ui.postMessage({ type: "SUCCESS", message: "Interações de teclado removidas." });
    } catch (err) {
      figma.ui.postMessage({ type: "ERROR", message: "Erro ao limpar: " + err.message });
    }
    return;
  }

  if (msg.type === "CLOSE") figma.closePlugin();
};
