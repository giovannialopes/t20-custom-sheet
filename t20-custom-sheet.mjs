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
	
	// Método 1: Buscar diretamente no Map de sheetClasses
	try {
		const sheetClasses = foundry.documents.collections.Actors?.sheetClasses;
		if (sheetClasses && sheetClasses instanceof Map) {
			// sheetClasses é um Map onde a chave é o scope (ex: "tormenta20")
			const tormenta20Sheets = sheetClasses.get("tormenta20");
			if (tormenta20Sheets && tormenta20Sheets instanceof Map) {
				// tormenta20Sheets é um Map onde a chave é a classe e o valor é a config
				for (const [sheetClass, config] of tormenta20Sheets.entries()) {
					if (config && config.types && Array.isArray(config.types) && config.types.includes("character") && config.makeDefault) {
						BaseSheetClass = sheetClass;
						console.log("T20 Custom Sheet | Classe base encontrada nas sheets registradas");
						break;
					}
				}
			}
		}
	} catch (e) {
		console.warn("T20 Custom Sheet | Erro ao buscar nas sheets registradas", e);
	}
	
	// Método 2: Fallback - buscar através de uma instância existente
	if (!BaseSheetClass) {
		try {
			// Buscar um actor de character para pegar a classe da sheet
			const characterActor = game.actors?.find(a => a.type === "character");
			if (characterActor) {
				const currentSheet = characterActor.sheet;
				if (currentSheet && currentSheet.constructor) {
					// Verificar se é do sistema tormenta20
					if (currentSheet.constructor.name.includes("T20") || 
					    currentSheet.options?.classes?.includes("tormenta20")) {
						BaseSheetClass = currentSheet.constructor;
						console.log("T20 Custom Sheet | Classe base encontrada através de instância existente");
					}
				}
			}
		} catch (e2) {
			console.warn("T20 Custom Sheet | Erro ao buscar através de instância", e2);
		}
	}
	
	if (!BaseSheetClass) {
		console.error("T20 Custom Sheet | Não foi possível encontrar a classe base do sistema. A ficha customizada não será registrada.");
		console.error("T20 Custom Sheet | Debug - sheetClasses:", foundry.documents.collections.Actors?.sheetClasses);
		return;
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
			// O Foundry já posiciona as fichas à direita por padrão, não precisamos fazer nada
		}

		/** @override */
		get layout() {
			return "character-custom";
		}

		/** @override */
		get template() {
			return "modules/t20-custom-sheet/templates/actor/character-custom-sheet.hbs";
		}

		/** @override */
		async getData() {
			// Usar o método da classe base para obter todos os dados
			const sheetData = await super.getData();
			
			// Garantir que nivel tenha um valor válido
			if (sheetData.system?.attributes?.nivel) {
				if (sheetData.system.attributes.nivel.value === undefined || 
				    sheetData.system.attributes.nivel.value === null || 
				    isNaN(sheetData.system.attributes.nivel.value)) {
					sheetData.system.attributes.nivel.value = 1;
				} else {
					sheetData.system.attributes.nivel.value = Number(sheetData.system.attributes.nivel.value) || 1;
				}
			}
			
			// Garantir que os atributos tenham valores numéricos válidos
			if (sheetData.system?.atributos) {
				for (const [key, atr] of Object.entries(sheetData.system.atributos)) {
					if (atr) {
						atr.value = Number(atr.value) || 0;
						atr.base = Number(atr.base) || 0;
						atr.bonus = Number(atr.bonus) || 0;
						// Garantir que não sejam NaN
						if (isNaN(atr.value)) atr.value = 0;
						if (isNaN(atr.base)) atr.base = 0;
						if (isNaN(atr.bonus)) atr.bonus = 0;
					}
				}
			}
			
			// Garantir que defesa tenha um valor válido
			if (sheetData.system?.attributes?.defesa) {
				const defTotal = sheetData.system.attributes.defesa.total;
				if (defTotal === undefined || defTotal === null || isNaN(defTotal)) {
					sheetData.system.attributes.defesa.total = 0;
				} else {
					sheetData.system.attributes.defesa.total = Number(defTotal) || 0;
				}
				// Garantir que não seja NaN
				if (isNaN(sheetData.system.attributes.defesa.total)) {
					sheetData.system.attributes.defesa.total = 0;
				}
			}
			
			// Garantir que as perícias tenham valores numéricos válidos
			// O sistema calcula skill.value como o total através do prepareSkill
			// O template espera skill.total, então vamos garantir que total = value
			if (sheetData.skills) {
				for (const skill of Object.values(sheetData.skills)) {
					if (skill) {
						// O sistema calcula skill.value através do prepareSkill (é o total calculado)
						// Converter para número válido
						skill.value = Number(skill.value) || 0;
						if (isNaN(skill.value)) skill.value = 0;
						
						// O template espera skill.total, então vamos usar skill.value como total
						// (pois value já é o total calculado pelo sistema)
						skill.total = skill.value;
						
						// Garantir que bonus seja um número válido (se existir)
						if (skill.bonus !== undefined && skill.bonus !== null) {
							skill.bonus = Number(skill.bonus) || 0;
							if (isNaN(skill.bonus)) skill.bonus = 0;
						} else {
							skill.bonus = 0;
						}
					}
				}
			}
			
			return sheetData;
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
