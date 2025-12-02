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
			
			// Adicionar badges de tipo aos poderes após o render
			if (this.element && this.element.length) {
				const powerList = this.element.find('.list-powers .item-list .item');
				powerList.each((index, element) => {
					const $item = $(element);
					const itemId = $item.data('item-id');
					if (itemId) {
						const item = this.actor.items.get(itemId);
						if (item && item.type === 'poder') {
							// Buscar o nome do poder
							const $name = $item.find('.item-name h4, .item-name .item-name-input');
							
							// Verificar se já tem badge
							if ($name.find('.power-type-badge').length === 0) {
								// Obter tipo do poder
								let tipo = item.system?.tipo || item.system?.type || item.tipo || item.type || "geral";
								if (typeof tipo === 'object' && tipo !== null) {
									tipo = tipo.value || tipo.label || "geral";
								}
								tipo = String(tipo).toLowerCase().trim();
								
								// Mapear tipos
								const tipoLabels = {
									"geral": "Geral",
									"origem": "Origem",
									"classe": "Classe",
									"racial": "Racial",
									"racial_alternativa": "Racial Alternativa",
									"racial alternativa": "Racial Alternativa",
									"tormenta": "Tormenta",
									"devoto": "Devoto",
									"concedido": "Concedido",
									"complicacao": "Complicação",
									"complicação": "Complicação",
									"complicacão": "Complicação",
									"ability": "Ability",
									"arquetipo": "Arquétipo",
									"arquétipo": "Arquétipo",
									"multiclasse": "Multiclasse",
									"multi-classe": "Multiclasse"
								};
								
								const tipoLabel = tipoLabels[tipo] || tipo.charAt(0).toUpperCase() + tipo.slice(1);
								
								// Adicionar badge
								const badge = $('<span>')
									.addClass('power-type-badge')
									.addClass(`power-type-${tipo}`)
									.text(tipoLabel);
								
								$name.append(badge);
							}
						}
					}
				});
			}
		}

		/** @override */
		get layout() {
			return "character-custom";
		}
		
		/** @override */
		async _prepareItems(data) {
			// Chamar o método da classe base primeiro
			await super._prepareItems(data);
			
			// Garantir que inventario.itens seja criado mesmo com layout custom
			// O método base só cria se layout === "character-base"
			if (data.actor.inventario && !data.actor.inventario.itens) {
				// Coletar todos os itens de todas as categorias
				const allItems = [];
				if (data.actor.inventario.arma?.items) allItems.push(...data.actor.inventario.arma.items);
				if (data.actor.inventario.equipamento?.items) allItems.push(...data.actor.inventario.equipamento.items);
				if (data.actor.inventario.consumivel?.items) allItems.push(...data.actor.inventario.consumivel.items);
				if (data.actor.inventario.tesouro?.items) allItems.push(...data.actor.inventario.tesouro.items);
				
				data.actor.inventario.itens = { 
					label: "Itens", 
					items: allItems 
				};
			}
		}

		/** @override */
		get template() {
			return "modules/t20-custom-sheet/templates/actor/character-custom-sheet.hbs";
		}

		/** @override */
		async getData() {
			// Usar o método da classe base para obter todos os dados
			const sheetData = await super.getData();
			
			// Garantir que seja character
			if (this.actor.type !== "character") return sheetData;
			
			// Configurações do sistema (igual ao padrão)
			const limitedSetting = game.settings.get("tormenta20", "limitedSheet");
			sheetData.limited = !game.user.isGM && limitedSetting === "limited" && this.actor.limited;
			sheetData.disableExperience = game.settings.get("tormenta20", "disableExperience");
			sheetData.disableJournal = game.settings.get("tormenta20", "disableJournal");
			
			const levelConfig = this.actor.getFlag("tormenta20", "lvlconfig");
			sheetData.autoCalcResources = levelConfig ? !levelConfig.manual : true;
			
			sheetData.layout = this.layout;
			
			// Garantir que defesa.pda exista
			if (this.actor.system.attributes.defesa) {
				this.actor.system.attributes.defesa.pda = this.actor.system.attributes.defesa.pda ?? 0;
			}
			
			// Enriquecer campos HTML do diário (igual ao padrão)
			if (sheetData.system?.detalhes) {
				if (sheetData.system.detalhes.diario?.value) {
					sheetData.htmlFields.diario = await this.enrichHTML(sheetData.system.detalhes.diario.value, sheetData);
				}
				if (sheetData.system.detalhes.diario1?.value) {
					sheetData.htmlFields.diario1 = await this.enrichHTML(sheetData.system.detalhes.diario1.value, sheetData);
				}
				if (sheetData.system.detalhes.diario2?.value) {
					sheetData.htmlFields.diario2 = await this.enrichHTML(sheetData.system.detalhes.diario2.value, sheetData);
				}
				if (sheetData.system.detalhes.diario3?.value) {
					sheetData.htmlFields.diario3 = await this.enrichHTML(sheetData.system.detalhes.diario3.value, sheetData);
				}
				if (sheetData.system.detalhes.diario4?.value) {
					sheetData.htmlFields.diario4 = await this.enrichHTML(sheetData.system.detalhes.diario4.value, sheetData);
				}
			}
			
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
						// Validar atributo racial se existir
						if (atr.racial !== undefined && atr.racial !== null) {
							atr.racial = Number(atr.racial) || 0;
							if (isNaN(atr.racial)) atr.racial = 0;
						}
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
			if (sheetData.skills) {
				for (const skill of Object.values(sheetData.skills)) {
					if (skill) {
						// O sistema calcula skill.value através do prepareSkill (é o total calculado)
						// Converter para número válido
						skill.value = Number(skill.value) || 0;
						if (isNaN(skill.value)) skill.value = 0;
					}
				}
			}
			
			// Garantir que poderes seja um array
			if (!Array.isArray(sheetData.actor.poderes)) {
				sheetData.actor.poderes = [];
			}
			
			// Preparar tipos dos poderes para exibição
			if (Array.isArray(sheetData.actor.poderes)) {
				for (const poder of sheetData.actor.poderes) {
					if (poder && poder.system) {
						// Obter o tipo do poder de diferentes possíveis locais
						let tipo = poder.system.tipo || 
						           poder.system.type || 
						           poder.tipo || 
						           poder.type ||
						           "geral";
						
						// Se o tipo vier como objeto, pegar o valor
						if (typeof tipo === 'object' && tipo !== null) {
							tipo = tipo.value || tipo.label || "geral";
						}
						
						// Normalizar para string minúscula
						tipo = String(tipo).toLowerCase().trim();
						
						// Mapear tipos para labels mais amigáveis
						const tipoLabels = {
							"geral": "Geral",
							"origem": "Origem",
							"classe": "Classe",
							"racial": "Racial",
							"racial_alternativa": "Racial Alternativa",
							"racial alternativa": "Racial Alternativa",
							"tormenta": "Tormenta",
							"devoto": "Devoto",
							"arquetipo": "Arquétipo",
							"arquétipo": "Arquétipo",
							"multiclasse": "Multiclasse",
							"multi-classe": "Multiclasse"
						};
						
						// Adicionar label do tipo ao poder
						poder.tipoLabel = tipoLabels[tipo] || tipo.charAt(0).toUpperCase() + tipo.slice(1);
						poder.tipo = tipo;
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
