/**
 * T20 Custom Sheet Module
 * Módulo que adiciona uma nova ficha de personagem personalizada para Tormenta20
 */

/**
 * Nova ficha de personagem personalizada
 * Baseada na ActorSheetT20Character original
 * Estende da classe base do sistema T20 quando disponível
 */
class ActorSheetT20CustomCharacter extends foundry.appv1.sheets.ActorSheet {
	static MODES = {
		PLAY: 1,
		EDIT: 2
	};

	_mode = null;
	/* -------------------------------------------- */
	/*  Properties                                  */
	/* -------------------------------------------- */

	/** @override */
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ["tormenta20", "sheet", "actor", "character", "custom-sheet"],
			template: "modules/t20-custom-sheet/templates/actor/character-custom-sheet.hbs",
			width: 800,
			height: 600,
			left: 20,
			top: null,
			resizable: true,
			dragDrop: [{ dragSelector: ".item-list .item:not(.item-header)" }],
			scrollY: [
				".tormenta20.base .sheet-body",
				".tab.attributes",
				".tab.skills",
				".tab.spells",
				".tab.inventory",
				".tab.journal",
				".tab.effects"
			],
			tabs: [
				{
					navSelector: ".sheet-tabs",
					contentSelector: ".sheet-body",
					initial: "attributes"
				}
			]
		});
	}

	/** @override */
	async _render(force = false, options = {}) {
		await super._render(force, options);
		
		// Forçar posicionamento no lado esquerdo após renderização
		// Usar múltiplos métodos para garantir que funcione
		setTimeout(() => {
			this._forceLeftPosition();
		}, 0);
		
		requestAnimationFrame(() => {
			this._forceLeftPosition();
		});
	}

	/**
	 * Força a ficha a ficar no lado esquerdo da tela
	 */
	_forceLeftPosition() {
		if (!this.element || !this.element.length) return;
		
		const width = 800;
		const height = 600;
		
		// Calcular posição no lado esquerdo
		const viewportHeight = window.innerHeight || 1080;
		const left = 20;
		const top = Math.max(20, (viewportHeight - height) / 2);
		
		// Método 1: Usar setPosition se disponível
		if (typeof this.setPosition === 'function') {
			try {
				this.setPosition({
					width: width,
					height: height,
					left: left,
					top: top
				});
			} catch (e) {
				console.warn("Erro ao usar setPosition:", e);
			}
		}
		
		// Método 2: Aplicar diretamente no elemento
		if (this.element && this.element.css) {
			this.element.css({
				left: `${left}px !important`,
				top: `${top}px !important`,
				width: `${width}px`,
				height: `${height}px`
			});
		}
		
		// Método 3: Atualizar posição no objeto
		if (this.position) {
			this.position.left = left;
			this.position.top = top;
			this.position.width = width;
			this.position.height = height;
		}
		
		// Método 4: Aplicar diretamente no DOM se jQuery não funcionar
		const domElement = this.element?.[0] || this.element?.get?.(0);
		if (domElement) {
			domElement.style.left = `${left}px`;
			domElement.style.top = `${top}px`;
			domElement.style.width = `${width}px`;
			domElement.style.height = `${height}px`;
		}
	}

	/* -------------------------------------------- */

	get layout() {
		return "character-custom";
	}

	/* -------------------------------------------- */
	/*  SheetPreparation                            */
	/* -------------------------------------------- */

	/** @override */
	async getData() {
		// Usar a mesma lógica da ficha original, mas adaptada
		const source = this.actor.toObject();
		const actorData = this.actor.toObject(false);

		// Preparar dados básicos
		const sheetData = {
			isGM: game.user.isGM,
			actor: actorData,
			source: source.system,
			system: actorData.system,
			uuid: this.actor.uuid,
			skills: actorData.system.pericias,
			items: actorData.items,
			owner: this.actor.isOwner,
			limited: this.actor.limited,
			options: this.options,
			editable: this.isEditable,
			cssClass: this.actor.isOwner ? "editable" : "locked",
			isCharacter: this.actor.type === "character",
			config: CONFIG.T20,
			rollData: this.actor.getRollData?.bind(this.actor),
			htmlFields: {},
			layout: this.layout
		};

		if (this.actor.type !== "character") return sheetData;

		// Configurações básicas
		const limitedSetting = game.settings.get("tormenta20", "limitedSheet");
		sheetData.limited = !game.user.isGM && limitedSetting === "limited" && this.actor.limited;
		sheetData.disableExperience = game.settings.get("tormenta20", "disableExperience");
		sheetData.disableJournal = game.settings.get("tormenta20", "disableJournal");

		const levelConfig = this.actor.getFlag("tormenta20", "lvlconfig");
		sheetData.autoCalcResources = levelConfig ? !levelConfig.manual : true;

		// Preparar atributos
		if (sheetData.system.atributos) {
			for (let [a, abl] of Object.entries(sheetData.system.atributos)) {
				abl.label = CONFIG.T20.atributos?.[a] || a;
			}
		}

		// Preparar perícias
		if (sheetData.skills) {
			this._prepareSkills(sheetData);
		}

		// Preparar itens
		await this._prepareItems(sheetData);

		// Enrich HTML text
		if (sheetData.system.detalhes?.biography) {
			sheetData.htmlFields.biography = await this.enrichHTML(
				sheetData.system.detalhes.biography.value,
				sheetData
			);
		}

		return sheetData;
	}

	/* -------------------------------------------- */

	_prepareSkills(data) {
		if (!data.skills) return;
		
		// Adaptar a lógica de perícias do sistema original
		for (let [s, skl] of Object.entries(data.skills)) {
			skl.key = s;
			skl.label = CONFIG.T20.pericias?.[s]?.label || s;
			skl.symbol = skl.treinado ? "fas fa-check" : "far fa-circle";
			skl.exibir = true;
			
			// Calcular o total da perícia
			// Tentar usar o método do actor se disponível
			if (this.actor && typeof this.actor.getPericiaTotal === 'function') {
				try {
					skl.total = this.actor.getPericiaTotal(s);
				} catch (e) {
					console.warn("Erro ao calcular perícia com método do actor:", e);
					skl.total = 0;
				}
			} else {
				// Calcular manualmente: modificador do atributo + valor da perícia + bônus
				const skillConfig = CONFIG.T20.pericias?.[s];
				const attrKey = skillConfig?.atributo || skl.atributo;
				const attr = data.system.atributos?.[attrKey];
				const attrMod = attr ? (Number(attr.value) || 0) : 0;
				const skillValue = Number(skl.value) || 0;
				const skillBonus = Number(skl.bonus) || 0;
				
				skl.total = attrMod + skillValue + skillBonus;
			}
			
			// Garantir que total seja um número válido
			if (isNaN(skl.total) || skl.total === null || skl.total === undefined) {
				skl.total = 0;
			}
		}
		data.skills = Object.values(data.skills).sort((a, b) => {
			if (a.order === b.order) return (a.label || "").localeCompare(b.label || "");
			return (a.order || 0) - (b.order || 0);
		});
	}

	/* -------------------------------------------- */

	async _prepareItems(data) {
		// Adaptar a lógica de preparação de itens
		const actorData = data.actor;
		
		// Organizar itens por tipo
		const items = {
			armas: [],
			equipamentos: [],
			consumiveis: [],
			poderes: [],
			magias: [],
			classes: []
		};

		// Processar itens do ator
		for (let itemData of data.items || []) {
			const itemObj = this.actor.items.get(itemData._id);
			if (!itemObj) continue;

			itemData.img = itemData.img || CONST.DEFAULT_TOKEN;
			itemData.labels = itemObj.labels;

			// Enriquecer descrição se disponível
			if (itemData.system?.description?.value) {
				try {
					itemData.system.description.value = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
						itemData.system.description.value,
						{
							secrets: this.actor.isOwner,
							async: true,
							relativeTo: itemObj
						}
					);
				} catch (err) {
					console.warn("Erro ao enriquecer descrição do item:", err);
				}
			}

			// Organizar por tipo
			switch (itemData.type) {
				case "arma":
					items.armas.push(itemData);
					break;
				case "equipamento":
					items.equipamentos.push(itemData);
					break;
				case "consumivel":
					items.consumiveis.push(itemData);
					break;
				case "poder":
					items.poderes.push(itemData);
					break;
				case "magia":
					items.magias.push(itemData);
					break;
				case "classe":
					items.classes.push(itemData);
					break;
			}
		}

		actorData.items = items;
		actorData.race = this.actor.itemTypes?.race?.[0];
	}

	/* -------------------------------------------- */

	async enrichHTML(text, data) {
		return await foundry.applications.ux.TextEditor.implementation.enrichHTML(text, {
			secrets: this.actor.isOwner,
			rollData: data.rollData || this.actor.getRollData.bind(this.actor),
			async: true,
			relativeTo: this.actor
		});
	}

	/* -------------------------------------------- */
	/*  Event Handlers                              */
	/* -------------------------------------------- */

	/** @override */
	activateListeners(html) {
		super.activateListeners(html);

		if (!this.isEditable) return;

		// Input focus
		html.find("input").focus((ev) => ev.currentTarget.select());

		// Rollable atributos
		html.find(".rollable.atributo-rollable").click(this._onRollAtributo.bind(this));

		// Rollable perícias
		html.find(".rollable.pericia-rollable").click(this._onRollPericia.bind(this));

		// Item rolls e controles
		html.find(".item .item-image").click((event) => this._onItemRoll(event));
		html.find(".item-control.item-edit").click(this._onItemEdit.bind(this));
		html.find(".item-control.item-delete").click(this._onItemDelete.bind(this));
	}

	/* -------------------------------------------- */

	async _onRollAtributo(event) {
		event.preventDefault();
		let atributo = event.currentTarget.parentElement.dataset.itemId || event.currentTarget.dataset.itemId;
		if (this.actor.rollAtributo) {
			return await this.actor.rollAtributo(atributo, {
				event: event,
				message: true
			});
		}
	}

	async _onRollPericia(event) {
		event.preventDefault();
		let pericia = event.currentTarget.parentElement.dataset.itemId || event.currentTarget.dataset.itemId;
		if (this.actor.rollPericia) {
			return await this.actor.rollPericia(pericia, {
				event: event,
				message: true
			});
		}
	}

	_onItemRoll(event) {
		event.preventDefault();
		const itemId = event.currentTarget.closest(".item").dataset.itemId;
		const item = this.actor.items.get(itemId);
		if (!item) return;
		
		// Usar método roll do item se disponível
		if (item.roll) {
			return item.roll({ event });
		}
	}

	_onItemEdit(event) {
		event.preventDefault();
		const itemId = $(event.currentTarget).parents(".item").data("item-id");
		const item = this.actor.items.get(itemId);
		if (item) item.sheet.render(true);
	}

	_onItemDelete(event) {
		event.preventDefault();
		const itemId = $(event.currentTarget).parents(".item").data("item-id");
		const item = this.actor.items.get(itemId);
		if (item) item.delete();
	}

	/** @override */
	async _onDropItemCreate(itemData) {
		// Usar a mesma lógica do sistema original para drops
		itemData = Array.isArray(itemData) ? itemData : [itemData];
		return super._onDropItemCreate(itemData);
	}
}

/* -------------------------------------------- */
/*  Module Initialization                       */
/* -------------------------------------------- */

Hooks.once("init", () => {
	console.log("T20 Custom Sheet | Inicializando módulo de ficha customizada");

	// Registrar a nova ficha como uma opção alternativa
	// Isso adiciona uma nova opção na lista de fichas disponíveis
	foundry.documents.collections.Actors.registerSheet("tormenta20", ActorSheetT20CustomCharacter, {
		types: ["character"],
		makeDefault: false, // Não tornar padrão, apenas uma opção adicional
		label: "T20 Custom Sheet" // Nome que aparecerá na seleção de ficha
	});

	console.log("T20 Custom Sheet | Ficha customizada registrada com sucesso!");
});

Hooks.once("ready", () => {
	console.log("T20 Custom Sheet | Módulo pronto para uso!");
});
