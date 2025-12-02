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
			
			// Adicionar badges de tipo aos poderes e configurar filtros
			setTimeout(() => {
				this._setupPowersSection();
			}, 100);
		}
		
		/** @override */
		activateListeners(html) {
			super.activateListeners(html);
			
			// Handler para ícones roláveis de poderes usando evento delegado (apenas um listener)
			html.off('click', '.list-powers-custom .power-icon').on('click', '.list-powers-custom .power-icon', this._onPowerIconClick.bind(this));
		}
		
		/**
		 * Handler para clique no ícone do poder
		 * GERAL: tenta usar o fluxo oficial do sistema (item.use / item.roll)
		 * e cai para mostrar o card em chat apenas como fallback.
		 */
		async _onPowerIconClick(event) {
			event.preventDefault();
			event.stopPropagation();
			
			// Prevenir múltiplos cliques rápidos
			if ($(event.currentTarget).hasClass('processing')) {
				return;
			}
			$(event.currentTarget).addClass('processing');
			
			const $icon = $(event.currentTarget);
			let itemId = $icon.data('item-id');
			
			// Se não tiver no ícone, procurar no elemento pai
			if (!itemId) {
				const $item = $icon.closest('[data-item-id]');
				if ($item.length) {
					itemId = $item.data('item-id');
				}
			}
			
			if (!itemId) {
				console.warn("T20 Custom Sheet | Não foi possível encontrar o ID do item");
				return;
			}
			
			const item = this.actor.items.get(itemId);
			if (!item) {
				console.warn("T20 Custom Sheet | Item não encontrado:", itemId);
				return;
			}
			
			if (item.type !== 'poder') {
				console.warn("T20 Custom Sheet | Item não é um poder:", item.type);
				return;
			}
			
			try {
				// 1) Fluxo oficial: tentar usar a habilidade do sistema T20
				if (typeof item.use === "function") {
					await item.use();
					return;
				}

				// 2) Alternativa: se existir método roll padrão, usar
				if (typeof item.roll === "function") {
					await item.roll();
					return;
				}

				// 3) Fallback: Mostrar o card do poder no chat
				const speaker = ChatMessage.getSpeaker({actor: this.actor});
				
				// Tentar usar o template padrão do sistema T20 para o card do item
				let content = '';
				try {
					// Tentar diferentes possíveis caminhos de template
					const possibleTemplates = [
						"systems/tormenta20/templates/chat/item-card.hbs",
						"systems/tormenta20/templates/chat/power-card.hbs",
						"systems/tormenta20/templates/items/poder-chat.hbs"
					];
					
					let templateFound = false;
					for (const templatePath of possibleTemplates) {
						try {
							content = await renderTemplate(templatePath, {
								item: item,
								actor: this.actor,
								data: item.system
							});
							templateFound = true;
							break;
						} catch (e) {
							// Continuar tentando outros templates
						}
					}
					
					// Se nenhum template funcionou, criar um card simples
					if (!templateFound) {
						let descricao = item.system?.descricao?.value || item.system?.description?.value || '';
						const tipo = item.labels?.tipo || item.system?.tipo || '';
						const ativacao = item.labels?.ativacao || item.system?.ativacao?.execucao || 'Passivo';
						const img = item.img || 'icons/svg/mystery-man.svg';
						
						// Enriquecer HTML da descrição se necessário
						if (descricao) {
							try {
								descricao = await TextEditor.enrichHTML(descricao, {
									async: true,
									relativeTo: this.actor
								});
							} catch (e) {
								// Se falhar, usar descrição original
							}
						}
						
						content = `<div class="t20-item-card" style="display: flex; gap: 10px; align-items: flex-start;">
							<img src="${img}" style="width: 64px; height: 64px; flex-shrink: 0; border: none; border-radius: 4px;" />
							<div style="flex: 1;">
								<h4 style="margin: 0 0 8px 0;">${item.name}</h4>
								${tipo ? `<p style="margin: 4px 0;"><strong>Tipo:</strong> ${tipo}</p>` : ''}
								${ativacao ? `<p style="margin: 4px 0;"><strong>Execução:</strong> ${ativacao}</p>` : ''}
								${descricao ? `<div class="item-description" style="margin-top: 8px;">${descricao}</div>` : ''}
							</div>
						</div>`;
					}
				} catch (templateError) {
					console.warn("T20 Custom Sheet | Erro ao renderizar template, usando card simples:", templateError);
					const descricao = item.system?.descricao?.value || item.system?.description?.value || '';
					const img = item.img || 'icons/svg/mystery-man.svg';
					content = `<div class="t20-item-card" style="display: flex; gap: 10px; align-items: flex-start;">
						<img src="${img}" style="width: 64px; height: 64px; flex-shrink: 0; border: none; border-radius: 4px;" />
						<div style="flex: 1;">
							<h4 style="margin: 0 0 8px 0;">${item.name}</h4>
							${descricao ? `<p>${descricao}</p>` : ''}
						</div>
					</div>`;
				}
				
				await ChatMessage.create({
					user: game.user.id,
					speaker: speaker,
					content: content
				});
				
			} catch (error) {
				console.error("T20 Custom Sheet | Erro ao exibir poder no chat:", error);
				ui.notifications.error(`Erro ao exibir ${item.name}`);
			} finally {
				// Remover classe de processamento após 500ms
				setTimeout(() => {
					$(event.currentTarget).removeClass('processing');
				}, 500);
			}
		}
		
		/**
		 * Configura a seção de poderes com tipos e filtros
		 */
		_setupPowersSection() {
			if (!this.element || !this.element.length) return;
			
			const $powersSection = this.element.find('.list-powers-custom');
			if ($powersSection.length === 0) return;
			
			// Adicionar tipos aos poderes
			this._addPowerTypeBadges();
			
			// Criar chips de resumo
			this._createPowerChips();
			
			// Configurar filtros
			this._setupPowerFilters();
		}
		/**
		 * Adiciona badges de tipo aos poderes e formata ativação/custo
		 */
		_addPowerTypeBadges() {
			const $powerItems = this.element.find('.list-powers-custom .power-item');
			
			$powerItems.each((index, element) => {
				const $item = $(element);
				const itemId = $item.data('item-id');
				
				if (!itemId) return;
				
				// Adicionar delay escalonado para animação de entrada
				$item.css('animation-delay', `${index * 0.05}s`);
				
				const item = this.actor.items.get(itemId);
				if (!item || item.type !== 'poder') return;
				
				// Obter tipo do poder
				let tipo = this._getPowerType(item);
				const tipoLabel = this._getPowerTypeLabel(tipo);
				
				// Detectar "Habilidade de Classe" pelo label localizado também (mais confiável)
				// Se o label for "Habilidade de Classe", forçar o tipo normalizado
				let tipoNormalizadoParaFiltro = this._normalizePowerTypeKey(tipo);
				if (tipoLabel && tipoLabel.toLowerCase().includes('habilidade') && tipoLabel.toLowerCase().includes('classe')) {
					tipoNormalizadoParaFiltro = 'habilidade-de-classe';
				}
				// Também verificar se o tipo original é "ability" (formato do sistema)
				if (tipo === 'ability' || tipo === 'habilidade-de-classe' || tipo === 'habilidade_de_classe') {
					tipoNormalizadoParaFiltro = 'habilidade-de-classe';
				}
				
				// Atualizar data attribute
				$item.attr('data-power-type', tipoNormalizadoParaFiltro);
				
				// Adicionar classe CSS ao item para garantir que os estilos sejam aplicados
				// Remove todas as classes power-type-item-* antigas
				const classesParaRemover = [];
				$item[0].classList.forEach(cls => {
					if (cls.startsWith('power-type-item-')) {
						classesParaRemover.push(cls);
					}
				});
				$item.removeClass(classesParaRemover.join(' '));
				// Adiciona a classe normalizada
				if (tipoNormalizadoParaFiltro) {
					$item.addClass(`power-type-item-${tipoNormalizadoParaFiltro}`);
				}
				
				// Adicionar badge de tipo
				const $badgePlaceholder = $item.find('.power-type-placeholder');
				if ($badgePlaceholder.length > 0 && $badgePlaceholder.hasClass('power-type-placeholder')) {
					// Normalizar o tipo para usar no CSS (substituir espaços e caracteres especiais por hífen)
					let tipoCss = tipo;
					// Tratamento especial: se o label for "Habilidade de Classe", forçamos o tipo CSS correspondente
					if (tipoLabel && tipoLabel.toLowerCase() === "habilidade de classe") {
						tipoCss = "habilidade-de-classe";
					}
					const tipoNormalizado = tipoCss.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '-').toLowerCase();
					
					$badgePlaceholder
						.removeClass('power-type-placeholder')
						.addClass('power-type-badge')
						.addClass(`power-type-${tipoNormalizado}`)
						.text(tipoLabel)
						.show();
				}
				
				// Formatar ativação e custo de mana
				this._formatPowerActivation($item, item);
				
				// Adicionar painel expansível ao poder (async para enriquecer HTML)
				this._addPowerTooltip($item, item, tipoLabel);
				
				// Configurar rolagem do dado ao clicar no ícone
				this._setupPowerIconRoll($item, item);
			});
		}
		
		/**
		 * Adiciona painel expansível ao poder com informações detalhadas
		 */
		_addPowerTooltip($item, item, tipoLabel) {
			// Verificar se já tem painel
			if ($item.find('.power-details-panel').length > 0) return;
			
			const $powerItemRow = $item.find('.power-item-row');
			if ($powerItemRow.length === 0) return;
			
			// Obter ativação já formatada do elemento (já foi formatada por _formatPowerActivation)
			const $activationText = $item.find('.power-activation .activation-text');
			let ativacaoText = $activationText.text() || "Passivo";
			
			// Obter descrição completa (será enriquecida quando expandir)
			let descricao = '';
			if (item.system?.descricao?.value) {
				descricao = item.system.descricao.value;
			} else if (item.system?.description?.value) {
				descricao = item.system.description.value;
			}
			
			// Criar container de descrição (será preenchido quando expandir)
			const $descContainer = $('<div>').addClass('power-details-description');
			
			// Criar painel de detalhes
			const $panel = $('<div>')
				.addClass('power-details-panel')
				.html(`
					<div class="power-details-header">
						<div class="power-details-title">${this._escapeHtml(item.name)}</div>
					</div>
					<div class="power-details-row">
						<span class="power-details-label">Tipo:</span>
						<span class="power-details-value">${this._escapeHtml(tipoLabel || 'Geral')}</span>
					</div>
					<div class="power-details-row">
						<span class="power-details-label">Execução:</span>
						<span class="power-details-value">${this._escapeHtml(ativacaoText)}</span>
					</div>
				`)
				.append($descContainer);
			
			// Adicionar painel após a row do item
			$powerItemRow.after($panel);
			
			// Variável para controlar se já foi enriquecido
			let enriched = false;
			
			// Adicionar evento de clique no nome para expandir/colapsar
			const $powerName = $item.find('.power-name');
			$powerName.off('click.power-expand').on('click.power-expand', async (event) => {
				event.stopPropagation();
				
				// Se expandindo pela primeira vez e tem descrição, enriquecer HTML
				if (!$item.hasClass('expanded') && descricao && !enriched) {
					enriched = true;
					try {
						const descricaoHtml = await TextEditor.enrichHTML(descricao, {
							async: true,
							relativeTo: this.actor
						});
						$descContainer.html(descricaoHtml);
					} catch (e) {
						// Fallback: escapar HTML se falhar
						$descContainer.html(this._escapeHtml(descricao));
					}
				}
				
				$item.toggleClass('expanded');
			});
		}
		
		/**
		 * Configura a rolagem do dado ao clicar no ícone do poder
		 */
		_setupPowerIconRoll($item, item) {
			const $powerIcon = $item.find('.power-icon');
			if ($powerIcon.length === 0) return;
			
			// Adicionar classe rollable e atributos necessários
			$powerIcon.addClass('rollable item-image').attr({
				'data-item-id': item.id,
				'data-item-type': 'poder'
			});
		}
		
		/**
		 * Escapa HTML para prevenir XSS
		 */
		_escapeHtml(text) {
			const div = document.createElement('div');
			div.textContent = text;
			return div.innerHTML;
		}
		
		/**
		 * Formata a ativação e custo de mana do poder
		 * Usa os labels do sistema para garantir consistência
		 */
		_formatPowerActivation($item, item) {
			const $activation = $item.find('.power-activation .activation-text');
			const $manaCost = $item.find('.power-activation .mana-cost');
			
			if ($activation.length === 0) return;
			
			// Usar o label já formatado pelo sistema (mais confiável)
			let ativacaoText = item.labels?.ativacao || "Passivo";
			
			// Se não tiver label, formatar manualmente usando CONFIG
			if (!item.labels?.ativacao && item.system?.ativacao) {
				const ativacao = item.system.ativacao;
				const execucao = ativacao.execucao;
				
				if (execucao) {
					// Usar CONFIG.T20 para obter o label localizado
					const execucaoConfig = CONFIG.T20.abilityActivationTypes[execucao];
					if (execucaoConfig) {
						ativacaoText = game.i18n.localize(execucaoConfig);
						
						// Para minute, hour, day: adicionar quantidade
						if (["minute", "hour", "day"].includes(execucao) && ativacao.qtd) {
							ativacaoText = `${ativacao.qtd} ${ativacaoText}`;
						}
						// Para special: usar texto especial
						else if (execucao === "special" && ativacao.special) {
							ativacaoText = ativacao.special;
						}
					} else {
						// Fallback: usar o valor direto
						ativacaoText = execucao;
					}
				}
			}
			
			// Obter custo de mana (PM) - usar item.system.ativacao.custo
			let manaCost = item.system?.ativacao?.custo || null;
			
			if (manaCost !== null && manaCost !== undefined) {
				// Se for objeto, pegar o valor
				if (typeof manaCost === 'object' && manaCost !== null) {
					manaCost = manaCost.value || manaCost.total || manaCost.base || null;
				}
				
				// Converter para número
				manaCost = Number(manaCost);
				
				if (!isNaN(manaCost) && manaCost > 0) {
					ativacaoText = `${ativacaoText} (${manaCost} PM)`;
				}
			}
			
			$activation.text(ativacaoText);
		}
		
		/**
		 * Obtém o tipo de um poder
		 * Usa item.system.tipo (campo padrão do sistema)
		 */
		_getPowerType(item) {
			// Priorizar item.system.tipo (campo padrão do sistema)
			let tipo = item.system?.tipo || null;
			
			// Fallbacks para compatibilidade
			if (!tipo) {
				tipo = item.system?.type || 
				       item.system?.categoria?.tipo ||
				       item.system?.categoria?.type ||
				       item.tipo || 
				       item.type || 
				       null;
			}
			
			// Se for objeto, extrair valor
			if (typeof tipo === 'object' && tipo !== null) {
				tipo = tipo.value || tipo.label || tipo.name || null;
			}
			
			// Normalizar para string minúscula
			if (tipo) {
				tipo = String(tipo).toLowerCase().trim();
			} else {
				tipo = "geral"; // Valor padrão do sistema
			}
			
			return tipo;
		}
		
		/**
		 * Obtém o label do tipo usando CONFIG.T20 (garante localização correta)
		 */
		_getPowerTypeLabel(tipo) {
			// Usar CONFIG.T20.powerType para obter o label localizado
			const powerTypeConfig = CONFIG.T20.powerType[tipo];
			if (powerTypeConfig) {
				return game.i18n.localize(powerTypeConfig);
			}
			
			// Fallback: capitalizar primeira letra
			return tipo.charAt(0).toUpperCase() + tipo.slice(1);
		}
		
		/**
		 * Normaliza um tipo de poder para uso consistente (remove acentos, espaços, etc)
		 * Converte para formato padronizado: habilidade-de-classe
		 */
		_normalizePowerTypeKey(tipo) {
			if (!tipo) return '';
			let normalized = String(tipo).toLowerCase().trim();
			
			// Substituir espaços e underscores por hífens
			normalized = normalized.replace(/[\s_]+/g, '-');
			
			// Normalizar variações comuns de "habilidade de classe"
			if (normalized.includes('habilidade') && normalized.includes('classe')) {
				normalized = 'habilidade-de-classe';
			}
			
			return normalized;
		}
		
		/**
		 * Cria o combobox de filtro por tipo de poder
		 */
		_createPowerChips() {
			const $combobox = this.element.find('#powers-combobox');
			if ($combobox.length === 0) return;
			
			// Manter a opção "Todos os tipos"
			$combobox.find('option:not(:first)').remove();
			
			// Coletar grupos de poderes
			const gruposPorTipo = {};
			
			this.element.find('.list-powers-custom .power-item').each((index, element) => {
				const $item = $(element);
				const tipo = $item.attr('data-power-type') || '';
				
				if (!tipo) return;
				
				// Normalizar tipo para chave
				const tipoKey = this._normalizePowerTypeKey(tipo);
				
				if (!gruposPorTipo[tipoKey]) {
					gruposPorTipo[tipoKey] = {
						tipo: tipoKey,
						count: 0,
						label: this._getPowerTypeLabel(tipoKey)
					};
				}
				
				gruposPorTipo[tipoKey].count++;
			});
			
			// Ordenar tipos em ordem amigável
			const ordemTipos = [
				"habilidade-de-classe",
				"classe",
				"concedido",
				"geral",
				"origem",
				"racial",
				"distinção",
				"distincao",
				"complicação",
				"complicacao",
				"complicacão"
			];
			
			// Adicionar opções ao combobox na ordem definida
			for (const tipo of ordemTipos) {
				if (gruposPorTipo[tipo]) {
					const grupo = gruposPorTipo[tipo];
					const tipoNormalizado = this._normalizePowerTypeKey(grupo.tipo);
					const $option = $('<option>')
						.attr('value', tipoNormalizado)
						.text(`${grupo.label} (${grupo.count})`);
					
					$combobox.append($option);
					delete gruposPorTipo[tipo];
				}
			}
			
			// Adicionar tipos restantes (não previstos)
			for (const tipo in gruposPorTipo) {
				if (!Object.prototype.hasOwnProperty.call(gruposPorTipo, tipo)) continue;
				const grupo = gruposPorTipo[tipo];
				const tipoNormalizado = this._normalizePowerTypeKey(grupo.tipo);
				const $option = $('<option>')
					.attr('value', tipoNormalizado)
					.text(`${grupo.label} (${grupo.count})`);
				
				$combobox.append($option);
			}
		}
		
		/**
		 * Configura os filtros de poderes (através do combobox)
		 */
		_setupPowerFilters() {
			const $combobox = this.element.find('#powers-combobox');
			if ($combobox.length === 0) return;
			
			// Função de filtro
			const filterPowers = (typeFilter = '') => {
				const normalizedTypeFilter = typeFilter ? this._normalizePowerTypeKey(typeFilter) : '';
				
				// Coletar todos os itens primeiro para aplicar animação
				const itemsToShow = [];
				const itemsToHide = [];
				
				this.element.find('.list-powers-custom .power-item').each((index, element) => {
					const $item = $(element);
					const itemType = ($item.attr('data-power-type') || '').toLowerCase();
					
					const typeMatch = !normalizedTypeFilter || this._normalizePowerTypeKey(itemType) === normalizedTypeFilter;
					
					if (typeMatch) {
						itemsToShow.push({$item, index});
					} else {
						itemsToHide.push({$item, index});
					}
				});
				
				// Animar itens que serão escondidos
				itemsToHide.forEach(({$item}) => {
					$item.addClass('hidden');
				});
				
				// Animar itens que serão mostrados com delay escalonado
				itemsToShow.forEach(({$item, index}) => {
					if ($item.hasClass('hidden')) {
						setTimeout(() => {
							$item.removeClass('hidden');
							$item.addClass('entering');
							// Remover classe após animação completar
							setTimeout(() => {
								$item.removeClass('entering');
							}, 300);
						}, Math.min(index * 30, 150)); // Delay máximo de 150ms total
					}
				});
			};
			
			// Event listener para combobox
			$combobox.off('change.combobox-filter').on('change.combobox-filter', (event) => {
				const selectedValue = $(event.currentTarget).val() || '';
				filterPowers(selectedValue);
			});
			
			// Event listeners para controles de editar e deletar
			this.element.find('.list-powers-custom .item-edit').off('click').on('click', (event) => {
				event.preventDefault();
				const itemId = $(event.currentTarget).data('item-id');
				const item = this.actor.items.get(itemId);
				if (item) item.sheet.render(true);
			});
			
			this.element.find('.list-powers-custom .item-delete').off('click').on('click', (event) => {
				event.preventDefault();
				const itemId = $(event.currentTarget).data('item-id');
				const item = this.actor.items.get(itemId);
				if (item) {
					item.delete();
					// Recriar combobox e reaplicar filtros após deletar
					setTimeout(() => {
						const currentValue = $combobox.val() || '';
						this._addPowerTypeBadges();
						this._createPowerChips();
						// Restaurar valor selecionado e aplicar filtro
						setTimeout(() => {
							$combobox.val(currentValue);
							filterPowers(currentValue);
						}, 50);
					}, 100);
				}
			});
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
			
			// Preparar tipos dos poderes para exibição e agrupar por tipo
			if (Array.isArray(sheetData.actor.poderes) && sheetData.actor.poderes.length > 0) {
				const gruposPorTipo = {};
				
				for (const poder of sheetData.actor.poderes) {
					if (!poder || !poder.system) continue;
					
					// Obter o tipo do poder (campo padrão: system.tipo)
					let tipo = poder.system.tipo || "geral";
					
					// Se o tipo vier como objeto, pegar o valor
					if (typeof tipo === 'object' && tipo !== null) {
						tipo = tipo.value || tipo.label || "geral";
					}
					
					// Normalizar para string minúscula
					tipo = String(tipo).toLowerCase().trim();
					
					// Usar CONFIG.T20 para obter o label localizado
					const powerTypeConfig = CONFIG.T20.powerType[tipo];
					let tipoLabel;
					if (powerTypeConfig) {
						tipoLabel = game.i18n.localize(powerTypeConfig);
					} else {
						// Fallback: usar label do sistema se disponível
						tipoLabel = poder.labels?.tipo || tipo.charAt(0).toUpperCase() + tipo.slice(1);
					}
					
					// Garantir que tipo e label estejam disponíveis no próprio poder
					poder.tipo = tipo;
					poder.tipoLabel = tipoLabel;
					
					// Criar grupo se ainda não existir
					if (!gruposPorTipo[tipo]) {
						gruposPorTipo[tipo] = {
							tipo,
							label: tipoLabel,
							items: []
						};
					}
					
					gruposPorTipo[tipo].items.push(poder);
				}
				
				// Ordenar grupos em uma ordem amigável (seguindo o filtro)
				const ordemTipos = [
					"habilidade-de-classe",
					"classe",
					"concedido",
					"geral",
					"origem",
					"racial",
					"distinção",
					"distincao",
					"complicação",
					"complicacao",
					"complicacão"
				];
				
				const gruposOrdenados = [];
				
				for (const tipo of ordemTipos) {
					if (gruposPorTipo[tipo]) {
						const grupo = gruposPorTipo[tipo];
						grupo.count = grupo.items.length;
						gruposOrdenados.push(grupo);
						delete gruposPorTipo[tipo];
					}
				}
				
				// Qualquer tipo restante (não previsto) entra no final
				for (const tipo in gruposPorTipo) {
					if (!Object.prototype.hasOwnProperty.call(gruposPorTipo, tipo)) continue;
					const grupo = gruposPorTipo[tipo];
					grupo.count = grupo.items.length;
					gruposOrdenados.push(grupo);
				}
				
				sheetData.actor.poderesPorTipo = gruposOrdenados;
			} else {
				sheetData.actor.poderesPorTipo = [];
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
