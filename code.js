// === Navegação Web por Teclado — código principal (roda na sandbox do Figma) ===

figma.showUI(__html__, { width: 420, height: 392 });

// Tipos de nó que podem ser origem/destino de uma interação de protótipo
const NAV_TYPES = ["FRAME", "COMPONENT", "COMPONENT_SET", "INSTANCE"];

const TYPE_LABEL = {
  FRAME: "", COMPONENT: " ◆", COMPONENT_SET: " ◆◆", INSTANCE: " ◇",
};

// --- Util: lista frames/componentes da página (recursivo, inclui filhos) ---
function getFrames() {
  const nodes = figma.currentPage.findAllWithCriteria({ types: NAV_TYPES });
  return nodes.map(n => ({
    id: n.id,
    name: n.name + (TYPE_LABEL[n.type] || ""),
    rawName: n.name,
    type: n.type,
    depth: getDepth(n),
  }));
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
    .filter(n => NAV_TYPES.includes(n.type))
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
      if (!sourceNode || !NAV_TYPES.includes(sourceNode.type)) {
        figma.ui.postMessage({ type: "ERROR", message: "Origem não encontrada ou tipo inválido." });
        return;
      }
      const destNode = await figma.getNodeByIdAsync(destinationId);
      if (!destNode || !NAV_TYPES.includes(destNode.type)) {
        figma.ui.postMessage({ type: "ERROR", message: "Destino não encontrado ou tipo inválido." });
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
      if (!sourceNode || !NAV_TYPES.includes(sourceNode.type)) {
        figma.ui.postMessage({ type: "ERROR", message: "Nó não encontrado ou tipo inválido." });
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
