/**
 * T20 Powers Module
 * Módulo responsável por toda a lógica relacionada a poderes na ficha customizada
 */

/**
 * Classe que gerencia a seção de poderes
 */
export class PowersManager {
	constructor(sheetInstance) {
		this.sheet = sheetInstance;
		this.actor = sheetInstance.actor;
		this.element = sheetInstance.element;
	}

	/**
	 * Configura a seção de poderes com tipos e filtros
	 */
	setupPowersSection() {
		if (!this.element || !this.element.length) return;
		
		const $powersSection = this.element.find('.list-powers-custom');
		if ($powersSection.length === 0) return;
		
		// Adicionar tipos aos poderes
		this.addPowerTypeBadges();
		
		// Criar combobox de filtro
		this.createPowerChips();
		
		// Configurar filtros
		this.setupPowerFilters();
	}

	/**
	 * Adiciona badges de tipo aos poderes e formata ativação/custo
	 */
	addPowerTypeBadges() {
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
			let tipo = this.getPowerType(item);
			const tipoLabel = this.getPowerTypeLabel(tipo);
			
			// Detectar "Habilidade de Classe" pelo label localizado também (mais confiável)
			let tipoNormalizadoParaFiltro = this.normalizePowerTypeKey(tipo);
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
			const classesParaRemover = [];
			$item[0].classList.forEach(cls => {
				if (cls.startsWith('power-type-item-')) {
					classesParaRemover.push(cls);
				}
			});
			$item.removeClass(classesParaRemover.join(' '));
			if (tipoNormalizadoParaFiltro) {
				$item.addClass(`power-type-item-${tipoNormalizadoParaFiltro}`);
			}
			
			// Adicionar badge de tipo
			const $badgePlaceholder = $item.find('.power-type-placeholder');
			if ($badgePlaceholder.length > 0 && $badgePlaceholder.hasClass('power-type-placeholder')) {
				let tipoCss = tipo;
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
			this.formatPowerActivation($item, item);
			
			// Adicionar painel expansível ao poder (async para enriquecer HTML)
			this.addPowerTooltip($item, item, tipoLabel);
			
			// Configurar rolagem do dado ao clicar no ícone
			this.setupPowerIconRoll($item, item);
		});
	}

	/**
	 * Adiciona painel expansível ao poder com informações detalhadas
	 */
	addPowerTooltip($item, item, tipoLabel) {
		if ($item.find('.power-details-panel').length > 0) return;
		
		const $powerItemRow = $item.find('.power-item-row');
		if ($powerItemRow.length === 0) return;
		
		const $activationText = $item.find('.power-activation .activation-text');
		let ativacaoText = $activationText.text() || "Passivo";
		
		let descricao = '';
		if (item.system?.descricao?.value) {
			descricao = item.system.descricao.value;
		} else if (item.system?.description?.value) {
			descricao = item.system.description.value;
		}
		
		const $descContainer = $('<div>').addClass('power-details-description');
		
		const $panel = $('<div>')
			.addClass('power-details-panel')
			.html(`
				<div class="power-details-header">
					<div class="power-details-title">${this.escapeHtml(item.name)}</div>
				</div>
				<div class="power-details-row">
					<span class="power-details-label">Tipo:</span>
					<span class="power-details-value">${this.escapeHtml(tipoLabel || 'Geral')}</span>
				</div>
				<div class="power-details-row">
					<span class="power-details-label">Execução:</span>
					<span class="power-details-value">${this.escapeHtml(ativacaoText)}</span>
				</div>
			`)
			.append($descContainer);
		
		$powerItemRow.after($panel);
		
		let enriched = false;
		
		const $powerName = $item.find('.power-name');
		$powerName.off('click.power-expand').on('click.power-expand', async (event) => {
			event.stopPropagation();
			
			if (!$item.hasClass('expanded') && descricao && !enriched) {
				enriched = true;
				try {
					const descricaoHtml = await TextEditor.enrichHTML(descricao, {
						async: true,
						relativeTo: this.actor
					});
					$descContainer.html(descricaoHtml);
				} catch (e) {
					$descContainer.html(this.escapeHtml(descricao));
				}
			}
			
			$item.toggleClass('expanded');
		});
	}

	/**
	 * Configura a rolagem do dado ao clicar no ícone do poder
	 */
	setupPowerIconRoll($item, item) {
		const $powerIcon = $item.find('.power-icon');
		if ($powerIcon.length === 0) return;
		
		$powerIcon.addClass('rollable item-image').attr({
			'data-item-id': item.id,
			'data-item-type': 'poder'
		});
	}

	/**
	 * Escapa HTML para prevenir XSS
	 */
	escapeHtml(text) {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}

	/**
	 * Formata a ativação e custo de mana do poder
	 */
	formatPowerActivation($item, item) {
		const $activation = $item.find('.power-activation .activation-text');
		
		if ($activation.length === 0) return;
		
		let ativacaoText = item.labels?.ativacao || "Passivo";
		
		if (!item.labels?.ativacao && item.system?.ativacao) {
			const ativacao = item.system.ativacao;
			const execucao = ativacao.execucao;
			
			if (execucao) {
				const execucaoConfig = CONFIG.T20.abilityActivationTypes[execucao];
				if (execucaoConfig) {
					ativacaoText = game.i18n.localize(execucaoConfig);
					
					if (["minute", "hour", "day"].includes(execucao) && ativacao.qtd) {
						ativacaoText = `${ativacao.qtd} ${ativacaoText}`;
					}
					else if (execucao === "special" && ativacao.special) {
						ativacaoText = ativacao.special;
					}
				} else {
					ativacaoText = execucao;
				}
			}
		}
		
		let manaCost = item.system?.ativacao?.custo || null;
		
		if (manaCost !== null && manaCost !== undefined) {
			if (typeof manaCost === 'object' && manaCost !== null) {
				manaCost = manaCost.value || manaCost.total || manaCost.base || null;
			}
			
			manaCost = Number(manaCost);
			
			if (!isNaN(manaCost) && manaCost > 0) {
				ativacaoText = `${ativacaoText} (${manaCost} PM)`;
			}
		}
		
		$activation.text(ativacaoText);
	}

	/**
	 * Obtém o tipo de um poder
	 */
	getPowerType(item) {
		let tipo = item.system?.tipo || null;
		
		if (!tipo) {
			tipo = item.system?.type || 
			       item.system?.categoria?.tipo ||
			       item.system?.categoria?.type ||
			       item.tipo || 
			       item.type || 
			       null;
		}
		
		if (typeof tipo === 'object' && tipo !== null) {
			tipo = tipo.value || tipo.label || tipo.name || null;
		}
		
		if (tipo) {
			tipo = String(tipo).toLowerCase().trim();
		} else {
			tipo = "geral";
		}
		
		return tipo;
	}

	/**
	 * Obtém o label do tipo usando CONFIG.T20
	 */
	getPowerTypeLabel(tipo) {
		const powerTypeConfig = CONFIG.T20.powerType[tipo];
		if (powerTypeConfig) {
			return game.i18n.localize(powerTypeConfig);
		}
		
		return tipo.charAt(0).toUpperCase() + tipo.slice(1);
	}

	/**
	 * Normaliza um tipo de poder para uso consistente
	 */
	normalizePowerTypeKey(tipo) {
		if (!tipo) return '';
		let normalized = String(tipo).toLowerCase().trim();
		
		normalized = normalized.replace(/[\s_]+/g, '-');
		
		if (normalized.includes('habilidade') && normalized.includes('classe')) {
			normalized = 'habilidade-de-classe';
		}
		
		return normalized;
	}

	/**
	 * Cria o combobox de filtro por tipo de poder
	 */
	createPowerChips() {
		const $combobox = this.element.find('#powers-combobox');
		if ($combobox.length === 0) return;
		
		const currentSelectedValue = $combobox.val() || '';
		$combobox.find('option:not(:first)').remove();
		
		const gruposPorTipo = {};
		
		this.element.find('.list-powers-custom .power-item').each((index, element) => {
			const $item = $(element);
			const tipo = $item.attr('data-power-type') || '';
			
			if (!tipo) return;
			
			const tipoKey = this.normalizePowerTypeKey(tipo);
			
			if (!gruposPorTipo[tipoKey]) {
				gruposPorTipo[tipoKey] = {
					tipo: tipoKey,
					count: 0,
					label: this.getPowerTypeLabel(tipoKey)
				};
			}
			
			gruposPorTipo[tipoKey].count++;
		});
		
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
		
		for (const tipo of ordemTipos) {
			if (gruposPorTipo[tipo]) {
				const grupo = gruposPorTipo[tipo];
				const tipoNormalizado = this.normalizePowerTypeKey(grupo.tipo);
				const $option = $('<option>')
					.attr('value', tipoNormalizado)
					.text(`${grupo.label} (${grupo.count})`);
				
				$combobox.append($option);
				delete gruposPorTipo[tipo];
			}
		}
		
		for (const tipo in gruposPorTipo) {
			if (!Object.prototype.hasOwnProperty.call(gruposPorTipo, tipo)) continue;
			const grupo = gruposPorTipo[tipo];
			const tipoNormalizado = this.normalizePowerTypeKey(grupo.tipo);
			const $option = $('<option>')
				.attr('value', tipoNormalizado)
				.text(`${grupo.label} (${grupo.count})`);
			
			$combobox.append($option);
		}
		
		if (currentSelectedValue) {
			const optionExists = $combobox.find(`option[value="${currentSelectedValue}"]`).length > 0;
			if (optionExists) {
				$combobox.val(currentSelectedValue);
				$combobox[0].selectedIndex = $combobox.find(`option[value="${currentSelectedValue}"]`).index();
				const selectedText = $combobox.find(`option[value="${currentSelectedValue}"]`).text();
				const $container = $combobox.closest('.powers-combobox-container');
				if ($container.length > 0) {
					$container.attr('data-selected-text', selectedText);
				}
				$combobox.trigger('change.combobox-filter');
			}
		} else {
			const $container = $combobox.closest('.powers-combobox-container');
			if ($container.length > 0) {
				$container.attr('data-selected-text', 'Todos os tipos');
			}
		}
	}

	/**
	 * Configura os filtros de poderes (através do combobox)
	 */
	setupPowerFilters() {
		const $combobox = this.element.find('#powers-combobox');
		if ($combobox.length === 0) return;
		
		const filterPowers = (typeFilter = '') => {
			const normalizedTypeFilter = typeFilter ? this.normalizePowerTypeKey(typeFilter) : '';
			
			const itemsToShow = [];
			const itemsToHide = [];
			
			this.element.find('.list-powers-custom .power-item').each((index, element) => {
				const $item = $(element);
				const itemType = ($item.attr('data-power-type') || '').toLowerCase();
				
				const typeMatch = !normalizedTypeFilter || this.normalizePowerTypeKey(itemType) === normalizedTypeFilter;
				
				if (typeMatch) {
					itemsToShow.push({$item, index});
				} else {
					itemsToHide.push({$item, index});
				}
			});
			
			itemsToHide.forEach(({$item}) => {
				$item.addClass('hidden');
			});
			
			itemsToShow.forEach(({$item, index}) => {
				if ($item.hasClass('hidden')) {
					setTimeout(() => {
						$item.removeClass('hidden');
						$item.addClass('entering');
						setTimeout(() => {
							$item.removeClass('entering');
						}, 300);
					}, Math.min(index * 30, 150));
				}
			});
		};
		
		const updateComboboxDisplayText = () => {
			const nativeSelect = $combobox[0];
			if (!nativeSelect) return;
			
			const selectedIndex = nativeSelect.selectedIndex;
			const selectedText = nativeSelect.options[selectedIndex] ? nativeSelect.options[selectedIndex].text : 'Todos os tipos';
			
			const $container = $combobox.closest('.powers-combobox-container');
			if ($container.length > 0) {
				$container.attr('data-selected-text', selectedText);
			}
		};
		
		updateComboboxDisplayText();
		
		$combobox.off('change.combobox-filter').on('change.combobox-filter', (event) => {
			const $select = $(event.currentTarget);
			const nativeSelect = $select[0];
			if (!nativeSelect) return;
			
			const selectedIndex = nativeSelect.selectedIndex;
			const selectedValue = nativeSelect.value || '';
			
			if (selectedValue !== $select.val()) {
				$select.val(selectedValue);
			}
			
			if (nativeSelect.selectedIndex !== selectedIndex) {
				nativeSelect.selectedIndex = selectedIndex;
			}
			
			updateComboboxDisplayText();
			filterPowers(selectedValue);
		});
		
		$combobox.on('focus.combobox-display', () => {
			updateComboboxDisplayText();
		});
		
		setTimeout(() => {
			updateComboboxDisplayText();
		}, 100);
		
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
				setTimeout(() => {
					const currentValue = $combobox.val() || '';
					this.addPowerTypeBadges();
					this.createPowerChips();
					setTimeout(() => {
						$combobox.val(currentValue);
						filterPowers(currentValue);
					}, 50);
				}, 100);
			}
		});
	}
}
