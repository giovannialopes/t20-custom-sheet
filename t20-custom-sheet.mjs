/**
 * T20 Custom Sheet Module
 * Módulo que adiciona uma nova ficha de personagem personalizada para Tormenta20
 */

/* -------------------------------------------- */
/*  Module Initialization                       */
/* -------------------------------------------- */

Hooks.once("ready", async () => {
	console.log("T20 Custom Sheet | Inicializando módulo de ficha customizada");

	// Aguardar o sistema Tormenta20 estar pronto antes de registrar
	// Tentar obter a classe base do sistema
	let BaseSheetClass;
	
	// Método 1: Tentar importar do sistema usando o caminho correto
	try {
		const systemId = game.system.id || "tormenta20";
		const module = await import(`systems/${systemId}/module/sheets/actor-character.mjs`);
		BaseSheetClass = module.default;
		console.log("T20 Custom Sheet | Classe base importada com sucesso");
	} catch (e) {
		console.warn("T20 Custom Sheet | Não foi possível importar a classe base diretamente, tentando método alternativo", e);
		
		// Método 2: Buscar nas sheets registradas
		try {
			const sheetClasses = foundry.documents.collections.Actors.sheetClasses;
			if (sheetClasses && sheetClasses.tormenta20) {
				// Procurar a sheet padrão de character
				for (const [sheetClass, config] of Object.entries(sheetClasses.tormenta20)) {
					if (config && config.types && config.types.includes("character") && config.makeDefault) {
						BaseSheetClass = sheetClass;
						console.log("T20 Custom Sheet | Classe base encontrada nas sheets registradas");
						break;
					}
				}
			}
		} catch (e2) {
			console.warn("T20 Custom Sheet | Erro ao buscar nas sheets registradas", e2);
		}
		
		if (!BaseSheetClass) {
			console.error("T20 Custom Sheet | Não foi possível encontrar a classe base do sistema. A ficha customizada não será registrada.");
			return;
		}
	}

	// Estender da classe base do sistema
	class ActorSheetT20CustomCharacter extends BaseSheetClass {
		static _warnedAppV1 = true; // Suprimir aviso de deprecação (a classe base também usa V1)

		/** @override */
		static get defaultOptions() {
			return foundry.utils.mergeObject(super.defaultOptions, {
				classes: ["tormenta20", "sheet", "actor", "character", "custom-sheet"],
				template: "modules/t20-custom-sheet/templates/actor/character-custom-sheet.hbs",
				width: 800,
				height: 600,
				left: null,
				top: null,
				resizable: true
			});
		}
		
		/** @override */
		get id() {
			return `t20-custom-sheet-${this.actor.id}`;
		}

		/** @override */
		async _render(force = false, options = {}) {
			await super._render(force, options);
			
			// Adicionar classe específica para CSS poder posicionar
			setTimeout(() => {
				if (this.element && this.element.length) {
					const domElement = this.element[0] || this.element.get?.(0);
					if (domElement) {
						const windowElement = domElement.closest?.('.window-app') || 
						                       domElement.parentElement?.closest?.('.window-app') ||
						                       $(domElement).parents('.window-app')[0];
						
						if (windowElement) {
							if (windowElement.classList) {
								windowElement.classList.add('t20-custom-sheet-window');
							} else if ($(windowElement).length) {
								$(windowElement).addClass('t20-custom-sheet-window');
							}
						}
					}
				}
			}, 100);
		}

		/** @override */
		get layout() {
			return "character-custom";
		}

		/** @override */
		get template() {
			return "modules/t20-custom-sheet/templates/actor/character-custom-sheet.hbs";
		}
	}

	// Registrar a nova ficha como uma opção alternativa
	foundry.documents.collections.Actors.registerSheet("tormenta20", ActorSheetT20CustomCharacter, {
		types: ["character"],
		makeDefault: false,
		label: "T20 Custom Sheet"
	});

	console.log("T20 Custom Sheet | Ficha customizada registrada com sucesso!");
});
