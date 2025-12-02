/**
 * T20 Items Manager
 * Gerencia a lógica de armas, equipamentos e inventário
 */

export class WeaponsManager {
	constructor(sheet) {
		this.sheet = sheet;
		this.actor = sheet.actor;
		this.element = sheet.element;
	}
	
	/**
	 * Configura a seção de armas com formatação de ataque/dano/crítico
	 */
	setupWeaponsSection() {
		if (!this.element || !this.element.length) return;
		
		const $weaponsList = this.element.find('.weapons-list-custom');
		if ($weaponsList.length === 0) return;
		
		const $weaponItems = $weaponsList.find('.weapon-item');
		
		$weaponItems.each((index, element) => {
			const $item = $(element);
			const itemId = $item.data('item-id') || $item.attr('data-item-id');
			
			if (!itemId) {
				console.warn("T20 Items Manager | Item ID não encontrado para arma");
				return;
			}
			
			// Adicionar delay escalonado para animação de entrada
			$item.css('animation-delay', `${index * 0.05}s`);
			
			const item = this.actor.items.get(itemId);
			if (!item) {
				console.warn("T20 Items Manager | Item não encontrado:", itemId);
				return;
			}
			
			if (item.type !== 'arma') {
				console.warn("T20 Items Manager | Item não é uma arma:", item.type);
				return;
			}
			
			// Formatar ataque, dano e crítico
			this.formatWeaponStats($item, item);
			
			// Configurar rolagem do dado ao clicar no ícone
			this.setupWeaponIconRoll($item, item);
			
			// Adicionar painel expansível com descrição
			this.addWeaponTooltip($item, item);
			
			// Configurar botão de equipar/desequipar
			this.setupWeaponToggle($item, item);
		});
	}
	
	/**
	 * Formata as estatísticas de ataque, dano e crítico da arma
	 */
	formatWeaponStats($item, item) {
		const $attackText = $item.find('.weapon-attack-text');
		
		if ($attackText.length === 0) {
			console.warn("T20 Items Manager | Elemento .weapon-attack-text não encontrado");
			return;
		}
		
		// Tentar usar labels do sistema primeiro (mais confiável)
		// O sistema T20 geralmente formata tudo em item.labels.ataque
		// Verificar todas as chaves possíveis em labels
		let finalText = item.labels?.ataque || 
		                item.labels?.attack || 
		                item.labels?.dano ||
		                item.labels?.damage ||
		                '';
		
		const system = item.system || {};
		
		// Debug completo para ver estrutura da arma
		console.log("T20 Items Manager | Estrutura completa do item (arma):", {
			name: item.name,
			labels: item.labels,
			labelsKeys: Object.keys(item.labels || {}),
			systemKeys: Object.keys(system),
			system: JSON.parse(JSON.stringify(system)), // Deep clone para ver tudo
			ataque: system.ataque,
			dano: system.dano,
			critico: system.critico,
			equipped: system.equipped,
			equipado: system.equipado,
			tipoUso: system.tipoUso,
			usageType: system.usageType
		});
		
		// Se não tiver label formatado, construir manualmente
		if (!finalText || finalText === '' || finalText === '-') {
			
			const ataque = system.ataque || system.attack || {};
			const dano = system.dano || system.damage || {};
			const critico = system.critico || system.critical || {};
			
			// Formatar ataque - tentar diferentes campos
			let ataqueValue = '';
			if (ataque.total !== undefined && ataque.total !== null && ataque.total !== '') {
				ataqueValue = ataque.total >= 0 ? `+${ataque.total}` : `${ataque.total}`;
			} else if (ataque.value !== undefined && ataque.value !== null && ataque.value !== '') {
				ataqueValue = ataque.value >= 0 ? `+${ataque.value}` : `${ataque.value}`;
			} else if (ataque.bonus !== undefined && ataque.bonus !== null && ataque.bonus !== '') {
				ataqueValue = ataque.bonus >= 0 ? `+${ataque.bonus}` : `${ataque.bonus}`;
			}
			
			// Formatar dano - o sistema T20 pode ter dano em formato de array ou objeto complexo
			let danoText = '';
			
			// Verificar se dano é um array (sistema T20 pode usar arrays para múltiplos danos)
			if (Array.isArray(dano)) {
				// Pegar o primeiro elemento do array
				const primeiroDano = dano[0] || {};
				if (primeiroDano.dado || primeiroDano.dice) {
					danoText = primeiroDano.dado || primeiroDano.dice;
					if (primeiroDano.bonus !== undefined && primeiroDano.bonus !== null && primeiroDano.bonus !== 0) {
						const bonusNum = Number(primeiroDano.bonus);
						if (!isNaN(bonusNum)) {
							danoText += bonusNum >= 0 ? ` + ${bonusNum}` : ` ${bonusNum}`;
						}
					}
				}
			} else if (typeof dano === 'string' && dano.trim() !== '') {
				danoText = dano;
			} else if (dano && typeof dano === 'object') {
				// Verificar diferentes campos possíveis
				if (dano.dado || dano.dice) {
					danoText = dano.dado || dano.dice;
					// Tentar diferentes campos para bonus
					const bonus = dano.bonus !== undefined ? dano.bonus : 
					             (dano.mod !== undefined ? dano.mod : 
					             (dano.value !== undefined ? dano.value : 
					             (dano.total !== undefined ? dano.total : null)));
					if (bonus !== undefined && bonus !== null && bonus !== 0 && bonus !== '') {
						const bonusNum = Number(bonus);
						if (!isNaN(bonusNum)) {
							danoText += bonusNum >= 0 ? ` + ${bonusNum}` : ` ${bonusNum}`;
						}
					}
				} else if (dano.total) {
					// Se tiver total formatado, usar direto
					danoText = String(dano.total);
				} else if (dano.formula) {
					// Se tiver fórmula, usar
					danoText = String(dano.formula);
				}
			}
			
			// Formatar crítico
			let criticoText = '';
			if (critico && typeof critico === 'object') {
				if (critico.range || critico.threat) {
					criticoText = String(critico.range || critico.threat);
					const multiplier = critico.multiplier || critico.mult;
					if (multiplier && multiplier !== 2 && multiplier !== '2') {
						criticoText += `/${multiplier}x`;
					}
				} else if (critico.total) {
					criticoText = String(critico.total);
				} else if (critico.value) {
					criticoText = String(critico.value);
				}
			} else if (critico) {
				criticoText = String(critico);
			}
			
			// Montar texto final no formato: +9 (1d4 + 5, 19)
			if (ataqueValue) {
				finalText = ataqueValue;
				if (danoText) {
					finalText += ` (${danoText}`;
					if (criticoText) {
						finalText += `, ${criticoText}`;
					}
					finalText += ')';
				} else if (criticoText) {
					finalText += ` (${criticoText})`;
				}
			} else if (danoText) {
				finalText = danoText;
				if (criticoText) {
					finalText += `, ${criticoText}`;
				}
			} else if (criticoText) {
				finalText = criticoText;
			}
			
			console.log("T20 Items Manager | Texto formatado (arma):", finalText, "de", {
				ataqueValue,
				danoText,
				criticoText
			});
		}
		
		$attackText.text(finalText || '-');
	}
	
	/**
	 * Configura a rolagem do dado ao clicar no ícone da arma
	 */
	setupWeaponIconRoll($item, item) {
		const $weaponIcon = $item.find('.weapon-icon');
		if ($weaponIcon.length === 0) return;
		
		$weaponIcon.addClass('rollable item-image').attr({
			'data-item-id': item.id,
			'data-item-type': 'arma'
		});
	}
	
	/**
	 * Adiciona painel expansível à arma com informações detalhadas
	 */
	addWeaponTooltip($item, item) {
		if ($item.find('.weapon-details-panel').length > 0) return;
		
		const $weaponItemRow = $item.find('.weapon-item-row');
		if ($weaponItemRow.length === 0) return;
		
		let descricao = '';
		if (item.system?.descricao?.value) {
			descricao = item.system.descricao.value;
		} else if (item.system?.description?.value) {
			descricao = item.system.description.value;
		}
		
		const $descContainer = $('<div>').addClass('weapon-details-description');
		
		// Obter estatísticas formatadas
		const $attackText = $item.find('.weapon-attack-text');
		const attackStats = $attackText.text() || '-';
		
		const $panel = $('<div>')
			.addClass('weapon-details-panel')
			.html(`
				<div class="weapon-details-header">
					<div class="weapon-details-title">${this.escapeHtml(item.name)}</div>
				</div>
				<div class="weapon-details-row">
					<span class="weapon-details-label">Ataque:</span>
					<span class="weapon-details-value">${this.escapeHtml(attackStats)}</span>
				</div>
			`)
			.append($descContainer);
		
		$weaponItemRow.after($panel);
		
		let enriched = false;
		
		const $weaponName = $item.find('.weapon-name');
		$weaponName.off('click.weapon-expand').on('click.weapon-expand', async (event) => {
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
	 * Handler para clique no ícone da arma
	 */
	async onWeaponIconClick(event) {
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
			console.warn("T20 Items Manager | Não foi possível encontrar o ID do item");
			return;
		}
		
		const item = this.actor.items.get(itemId);
		if (!item) {
			console.warn("T20 Items Manager | Item não encontrado:", itemId);
			return;
		}
		
		if (item.type !== 'arma') {
			console.warn("T20 Items Manager | Item não é uma arma:", item.type);
			return;
		}
		
		try {
			// 1) Fluxo oficial: tentar usar a arma do sistema T20
			if (typeof item.use === "function") {
				await item.use();
				return;
			}

			// 2) Alternativa: se existir método roll padrão, usar
			if (typeof item.roll === "function") {
				await item.roll();
				return;
			}

			// 3) Fallback: Mostrar o card da arma no chat
			const speaker = ChatMessage.getSpeaker({actor: this.actor});
			
			let content = '';
			try {
				const possibleTemplates = [
					"systems/tormenta20/templates/chat/item-card.hbs",
					"systems/tormenta20/templates/chat/weapon-card.hbs",
					"systems/tormenta20/templates/items/arma-chat.hbs"
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
					const img = item.img || 'icons/svg/mystery-man.svg';
					
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
					
					const ataque = item.labels?.ataque || '-';
					
					content = `<div class="t20-item-card" style="display: flex; gap: 10px; align-items: flex-start;">
						<img src="${img}" style="width: 64px; height: 64px; flex-shrink: 0; border: none; border-radius: 4px;" />
						<div style="flex: 1;">
							<h4 style="margin: 0 0 8px 0;">${item.name}</h4>
							${ataque ? `<p style="margin: 4px 0;"><strong>Ataque:</strong> ${ataque}</p>` : ''}
							${descricao ? `<div class="item-description" style="margin-top: 8px;">${descricao}</div>` : ''}
						</div>
					</div>`;
				}
			} catch (templateError) {
				console.warn("T20 Items Manager | Erro ao renderizar template, usando card simples:", templateError);
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
			console.error("T20 Items Manager | Erro ao exibir arma no chat:", error);
			ui.notifications.error(`Erro ao exibir ${item.name}`);
		} finally {
			// Remover classe de processamento após 500ms
			setTimeout(() => {
				$(event.currentTarget).removeClass('processing');
			}, 500);
		}
	}
	
	/**
	 * Handler para clique no nome da arma (expande/contrai descrição)
	 */
	onWeaponNameClick(event) {
		event.preventDefault();
		event.stopPropagation();
		
		const $name = $(event.currentTarget);
		const $item = $name.closest('.weapon-item');
		
		if ($item.length === 0) return;
		
		const itemId = $item.data('item-id') || $item.attr('data-item-id');
		if (!itemId) return;
		
		const item = this.actor.items.get(itemId);
		if (!item) return;
		
		// Toggle expanded class
		$item.toggleClass('expanded');
		
		// Enriquecer descrição na primeira expansão
		const $descContainer = $item.find('.weapon-details-description');
		if ($item.hasClass('expanded') && $descContainer.length > 0 && $descContainer.html().trim() === '') {
			let descricao = '';
			if (item.system?.descricao?.value) {
				descricao = item.system.descricao.value;
			} else if (item.system?.description?.value) {
				descricao = item.system.description.value;
			}
			
			if (descricao) {
				TextEditor.enrichHTML(descricao, {
					async: true,
					relativeTo: this.actor
				}).then(html => {
					$descContainer.html(html);
				}).catch(e => {
					$descContainer.html(this.escapeHtml(descricao));
				});
			}
		}
	}
	
	/**
	 * Configura o botão de equipar/desequipar arma
	 */
	setupWeaponToggle($item, item) {
		const $toggleBtn = $item.find('.weapon-toggle-btn');
		if ($toggleBtn.length === 0) return;
		
		const system = item.system || {};
		const tipoUso = system.tipoUso || system.usageType || '';
		const tipoUsoLower = tipoUso.toLowerCase();
		
		// Verificar se está equipado (empunhado)
		// No sistema T20:
		// - equipado pode ser 0 (não equipado), 1 (1 mão) ou 2 (2 mãos)
		// - tipoUso pode ser 'sim' quando está equipado
		// - equipped pode ser true/false ou undefined
		const equipadoValue = system.equipado;
		const equippedValue = system.equipped;
		
		const isEquipped = equippedValue === true || 
		                   (equipadoValue !== undefined && equipadoValue !== null && Number(equipadoValue) > 0) ||
		                   tipoUso === 'Empunhado' || 
		                   tipoUso === 'sim' ||
		                   tipoUsoLower === 'empunhado' ||
		                   tipoUsoLower === 'sim' ||
		                   tipoUsoLower.includes('empunhado');
		
		// Aplicar estado visual
		if (isEquipped) {
			// itemColor = "#ADD8E6" (Azul clarinho), highlight = true
			$toggleBtn.addClass('equipped').removeClass('not-equipped').attr('title', 'Desequipar');
			$toggleBtn.css({
				'border-color': '#ADD8E6 !important',
				'color': '#ADD8E6 !important',
				'background': 'rgba(173, 216, 230, 0.15) !important'
			});
			console.log("T20 Items Manager | Arma marcada como EQUIPADA (azul #ADD8E6) para:", item.name);
		} else {
			// Cor vermelha (já existe), highlight = false
			$toggleBtn.removeClass('equipped').addClass('not-equipped').attr('title', 'Equipar');
			$toggleBtn.css({
				'border-color': 'rgba(192, 57, 43, 0.8)',
				'color': 'rgba(192, 57, 43, 1)',
				'background': 'transparent'
			});
			console.log("T20 Items Manager | Arma marcada como NÃO EQUIPADA (vermelho) para:", item.name);
		}
		
		// Aplicar cor ao item também se necessário
		if (isEquipped) {
			$item.css('border-left-color', '#ADD8E6');
		}
		
		console.log("T20 Items Manager | Estado da arma:", {
			name: item.name,
			equipped: system.equipped,
			equipado: system.equipado,
			equipadoValue: equipadoValue,
			equippedValue: equippedValue,
			tipoUso: tipoUso,
			isEquipped: isEquipped,
			"equipadoValue > 0": equipadoValue !== undefined && equipadoValue !== null && Number(equipadoValue) > 0,
			"tipoUso === 'sim'": tipoUso === 'sim'
		});
	}
	
	/**
	 * Handler para toggle de equipar/desequipar arma
	 */
	async onWeaponToggleClick(event) {
		event.preventDefault();
		event.stopPropagation();
		
		const $btn = $(event.currentTarget);
		const $item = $btn.closest('.weapon-item');
		
		if ($item.length === 0) return;
		
		const itemId = $item.data('item-id') || $item.attr('data-item-id');
		if (!itemId) return;
		
		const item = this.actor.items.get(itemId);
		if (!item) return;
		
		const system = item.system || {};
		
		// Verificar estado atual usando a mesma lógica de setupWeaponToggle
		const equipadoValue = system.equipado;
		const equippedValue = system.equipped;
		const tipoUso = system.tipoUso || system.usageType || '';
		
		const currentEquipped = equippedValue === true || 
		                        (equipadoValue !== undefined && equipadoValue !== null && Number(equipadoValue) > 0) ||
		                        tipoUso === 'Empunhado' || 
		                        tipoUso === 'sim';
		
		const newEquipped = !currentEquipped;
		
		// No sistema T20, equipado é um número: 0 (não equipado), 1 (1 mão) ou 2 (2 mãos)
		// Se já estava equipado com 1 mão, manter 1; se estava com 2, manter 2
		// Se não estava equipado, usar 1 como padrão
		let newEquipadoValue = 0;
		if (newEquipped) {
			// Se já tinha um valor de equipado > 0, manter; senão usar 1 como padrão
			if (equipadoValue !== undefined && equipadoValue !== null && Number(equipadoValue) > 0) {
				newEquipadoValue = Number(equipadoValue);
			} else {
				newEquipadoValue = 1; // Padrão: 1 mão
			}
		}
		
		const newTipoUso = newEquipped ? 'sim' : '';
		
		try {
			// Atualizar o item - sincronizar equipado/equipped
			const updateData = {
				'system.equipped': newEquipped,
				'system.equipado': newEquipadoValue,
				'system.tipoUso': newTipoUso
			};
			
			await item.update(updateData);
			
			// Atualizar visualmente
			setTimeout(() => {
				this.setupWeaponsSection();
			}, 100);
		} catch (error) {
			console.error("T20 Items Manager | Erro ao equipar/desequipar arma:", error);
			ui.notifications.error(`Erro ao ${newEquipped ? 'equipar' : 'desequipar'} ${item.name}`);
		}
	}
	
	/**
	 * Escapa HTML para prevenir XSS
	 */
	escapeHtml(text) {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}
}

export class EquipmentManager {
	constructor(sheet) {
		this.sheet = sheet;
		this.actor = sheet.actor;
		this.element = sheet.element;
	}
	
	/**
	 * Configura a seção de equipamentos com formatação de defesa/espaço
	 */
	setupEquipmentSection() {
		if (!this.element || !this.element.length) return;
		
		const $equipmentList = this.element.find('.equipment-list-custom');
		if ($equipmentList.length === 0) return;
		
		const $equipmentItems = $equipmentList.find('.equipment-item');
		
		$equipmentItems.each((index, element) => {
			const $item = $(element);
			const itemId = $item.data('item-id') || $item.attr('data-item-id');
			
			if (!itemId) {
				console.warn("T20 Items Manager | Item ID não encontrado para equipamento");
				return;
			}
			
			// Adicionar delay escalonado para animação de entrada
			$item.css('animation-delay', `${index * 0.05}s`);
			
			const item = this.actor.items.get(itemId);
			if (!item) {
				console.warn("T20 Items Manager | Item não encontrado:", itemId);
				return;
			}
			
			if (item.type !== 'equipamento') {
				console.warn("T20 Items Manager | Item não é um equipamento:", item.type);
				return;
			}
			
			// Debug: verificar estrutura completa do equipamento
			const system = item.system || {};
			let tipoStrDebug = '';
			if (system.tipo) {
				if (typeof system.tipo === 'object') {
					tipoStrDebug = system.tipo.value || system.tipo.label || '';
				} else {
					tipoStrDebug = String(system.tipo);
				}
			}
			const labelsTipoDebug = item.labels?.tipo ? String(item.labels.tipo).toLowerCase() : '';
			const tipoLowerDebug = tipoStrDebug.toLowerCase();
			const isArmaduraDebug = tipoLowerDebug.includes('armadura') || labelsTipoDebug.includes('armadura');
			
			console.log("T20 Items Manager | Estrutura completa do item (equipamento):", {
				name: item.name,
				labels: item.labels,
				labelsKeys: Object.keys(item.labels || {}),
				systemKeys: Object.keys(system),
				system: JSON.parse(JSON.stringify(system)), // Deep clone para ver tudo
				tipo: system.tipo,
				tipoStr: tipoStrDebug,
				tipoLower: tipoLowerDebug,
				labelsTipo: item.labels?.tipo,
				labelsTipoLower: labelsTipoDebug,
				tipoUso: system.tipoUso,
				subtipo: system.subtipo,
				categoria: system.categoria,
				defesa: system.defesa,
				penalidade: system.penalidade,
				equipped: system.equipped,
				equipado: system.equipado,
				espaco: system.espaco,
				peso: system.peso,
				isArmadura: isArmaduraDebug,
				"tipoLower.includes('armadura')": tipoLowerDebug.includes('armadura'),
				"labelsTipo.includes('armadura')": labelsTipoDebug.includes('armadura')
			});
			
			// Formatar estatísticas (defesa/espaço)
			this.formatEquipmentStats($item, item);
			
			// Configurar rolagem do dado ao clicar no ícone
			this.setupEquipmentIconRoll($item, item);
			
			// Adicionar painel expansível com descrição
			this.addEquipmentTooltip($item, item);
		});
	}
	
	/**
	 * Formata as estatísticas de defesa/espaço do equipamento
	 * Processa o JSON do item seguindo regras específicas
	 */
	formatEquipmentStats($item, item) {
		const $statsText = $item.find('.equipment-stats-text');
		
		if ($statsText.length === 0) {
			console.warn("T20 Items Manager | Elemento .equipment-stats-text não encontrado");
			return;
		}
		
		const system = item.system || {};
		
		// 1. IDENTIFICAÇÃO BÁSICA - Verificar se é uma armadura
		let tipoStr = '';
		if (system.tipo) {
			if (typeof system.tipo === 'object') {
				tipoStr = system.tipo.value || system.tipo.label || system.tipo.name || '';
			} else {
				tipoStr = String(system.tipo);
			}
		}
		
		const tipoLower = tipoStr.toLowerCase();
		const labelsTipo = item.labels?.tipo ? String(item.labels.tipo).toLowerCase() : '';
		const nomeItem = item.name ? String(item.name).toLowerCase() : '';
		
		// Regras de identificação de armadura
		const isArmadura = labelsTipo.includes('armadura') ||
		                   tipoLower.includes('armadura') ||
		                   system.armadura !== undefined ||
		                   nomeItem.includes('armadura');
		
		console.log("T20 Items Manager | Verificação de armadura para", item.name, ":", {
			tipoStr,
			tipoLower,
			labelsTipo,
			nomeItem,
			"system.armadura": system.armadura,
			isArmadura,
			"labelsTipo.includes('armadura')": labelsTipo.includes('armadura'),
			"tipoLower.includes('armadura')": tipoLower.includes('armadura'),
			"nomeItem.includes('armadura')": nomeItem.includes('armadura')
		});
		
		let finalText = '';
		
		if (isArmadura) {
			// 3. DADOS DA ARMADURA (System)
			// Buscar defesa da armadura
			let defesaValue = null;
			
			// Priorizar system.armadura.value
			if (system.armadura && system.armadura.value !== undefined) {
				defesaValue = system.armadura.value;
			} else if (system.defesa) {
				if (typeof system.defesa === 'object') {
					defesaValue = system.defesa.total !== undefined ? system.defesa.total :
					              (system.defesa.value !== undefined ? system.defesa.value :
					              (system.defesa.bonus !== undefined ? system.defesa.bonus : null));
				} else {
					defesaValue = system.defesa;
				}
			} else if (system.defense) {
				if (typeof system.defense === 'object') {
					defesaValue = system.defense.total !== undefined ? system.defense.total :
					              (system.defense.value !== undefined ? system.defense.value :
					              (system.defense.bonus !== undefined ? system.defense.bonus : null));
				} else {
					defesaValue = system.defense;
				}
			}
			
			// Se undefined, usar 0
			if (defesaValue === null || defesaValue === undefined) {
				defesaValue = 0;
			}
			
			// Buscar penalidade
			let penalidadeValue = null;
			
			// Priorizar system.armadura.penalidade
			if (system.armadura && system.armadura.penalidade !== undefined) {
				penalidadeValue = system.armadura.penalidade;
			} else if (system.penalidade) {
				if (typeof system.penalidade === 'object') {
					penalidadeValue = system.penalidade.value !== undefined ? system.penalidade.value :
					                 (system.penalidade.total !== undefined ? system.penalidade.total :
					                 (system.penalidade.mod !== undefined ? system.penalidade.mod : null));
				} else {
					penalidadeValue = system.penalidade;
				}
			} else if (system.penalty) {
				if (typeof system.penalty === 'object') {
					penalidadeValue = system.penalty.value !== undefined ? system.penalty.value :
					                 (system.penalty.total !== undefined ? system.penalty.total :
					                 (system.penalty.mod !== undefined ? system.penalty.mod : null));
				} else {
					penalidadeValue = system.penalty;
				}
			}
			
			// Se undefined, usar 0
			if (penalidadeValue === null || penalidadeValue === undefined) {
				penalidadeValue = 0;
			}
			
			// Normalizar tipo para tipoLower (leve, média, pesada)
			let tipoArmaduraFinal = tipoLower;
			if (!tipoArmaduraFinal || tipoArmaduraFinal === '') {
				// Tentar extrair do tipo original
				if (tipoStr) {
					tipoArmaduraFinal = tipoStr.toLowerCase();
				} else {
					tipoArmaduraFinal = 'leve'; // Padrão
				}
			}
			
			// Remover "armadura" do tipo se presente, deixar só "leve", "pesada", etc
			if (tipoArmaduraFinal.includes('armadura')) {
				tipoArmaduraFinal = tipoArmaduraFinal.replace(/armadura\s*/gi, '').trim();
			}
			
			// Garantir que system.armadura existe e está preenchido
			if (!system.armadura) {
				system.armadura = {};
			}
			system.armadura.value = Number(defesaValue) || 0;
			system.armadura.penalidade = Number(penalidadeValue) || 0;
			system.armadura.tipo = tipoArmaduraFinal;
			
			// Atualizar system.tipo com tipoLower
			system.tipo = tipoArmaduraFinal;
			
			// 4. CATEGORIA
			system.categoria = 'Armadura';
			
			// Buscar tipo de uso (Vestido, Empunhado, etc) - campo "Tipo de Uso"
			let tipoUso = '';
			if (system.tipoUso) {
				if (typeof system.tipoUso === 'object') {
					tipoUso = system.tipoUso.value || system.tipoUso.label || system.tipoUso.name || '';
				} else {
					tipoUso = String(system.tipoUso);
				}
			} else if (system.usageType) {
				if (typeof system.usageType === 'object') {
					tipoUso = system.usageType.value || system.usageType.label || system.usageType.name || '';
				} else {
					tipoUso = String(system.usageType);
				}
			}
			
			// 5. CAMPO "EQUIPADO" E "EQUIPPED" - Sincronizar
			// Verificar se está equipado (vestido)
			const tipoUsoLower = tipoUso.toLowerCase();
			let isEquipped = system.equipped === true || 
			                 system.equipado === true || 
			                 tipoUso === 'Vestido' || 
			                 tipoUsoLower === 'vestido' ||
			                 tipoUsoLower === 'vestido/a' ||
			                 tipoUsoLower.includes('vestido');
			
			// Sincronizar campos
			if (isEquipped) {
				system.equipado = true;
				system.equipped = true;
			} else {
				system.equipado = false;
				system.equipped = false;
			}
			
			// Formatar defesa
			let defesaText = '';
			if (defesaValue !== null && defesaValue !== undefined && defesaValue !== '') {
				const defesaNum = Number(defesaValue);
				if (!isNaN(defesaNum)) {
					defesaText = defesaNum >= 0 ? `+${defesaNum}` : `${defesaNum}`;
				}
			}
			
			// Formatar penalidade
			let penalidadeText = '';
			if (penalidadeValue !== null && penalidadeValue !== undefined && penalidadeValue !== '') {
				const penalidadeNum = Number(penalidadeValue);
				if (!isNaN(penalidadeNum) && penalidadeNum !== 0) {
					penalidadeText = penalidadeNum >= 0 ? `+${penalidadeNum}` : `${penalidadeNum}`;
				}
			}
			
			// Montar texto final: "Tipo: Leve | Defesa: +5 | Penalidade: -2 | Uso: Vestido"
			const parts = [];
			if (tipoArmaduraFinal) {
				parts.push(`Tipo: ${tipoArmaduraFinal}`);
			}
			if (defesaText) {
				parts.push(`Defesa: ${defesaText}`);
			}
			if (penalidadeText) {
				parts.push(`Penalidade: ${penalidadeText}`);
			}
			if (tipoUso) {
				parts.push(`Uso: ${tipoUso}`);
			}
			
			finalText = parts.join(' | ');
			
			// 2. APARÊNCIA VISUAL (cor azul quando equipada)
			const $toggleBtn = $item.find('.equipment-toggle-btn');
			if ($toggleBtn.length > 0) {
				if (isEquipped) {
					// itemColor = "#ADD8E6" (Azul clarinho), highlight = true
					$toggleBtn.addClass('equipped').removeClass('not-equipped').attr('title', 'Desequipar');
					$toggleBtn.css({
						'border-color': '#ADD8E6 !important',
						'color': '#ADD8E6 !important',
						'background': 'rgba(173, 216, 230, 0.15) !important'
					});
					console.log("T20 Items Manager | Botão marcado como EQUIPADO (azul #ADD8E6) para:", item.name);
				} else {
					// Cor vermelha (já existe), highlight = false
					$toggleBtn.removeClass('equipped').addClass('not-equipped').attr('title', 'Equipar');
					$toggleBtn.css({
						'border-color': 'rgba(192, 57, 43, 0.8)',
						'color': 'rgba(192, 57, 43, 1)',
						'background': 'transparent'
					});
					console.log("T20 Items Manager | Botão marcado como NÃO EQUIPADO (vermelho) para:", item.name);
				}
			}
			
			// Aplicar cor ao item também se necessário
			if (isEquipped && isArmadura) {
				$item.css('border-left-color', '#ADD8E6');
			}
			
			console.log("T20 Items Manager | Estatísticas formatadas da armadura:", finalText, "de", {
				tipoArmadura: tipoArmaduraFinal,
				defesaValue: system.armadura.value,
				penalidadeValue: system.armadura.penalidade,
				tipoUso,
				isEquipped,
				equipado: system.equipado,
				equipped: system.equipped,
				categoria: system.categoria,
				"system.armadura": system.armadura,
				systemKeys: Object.keys(system)
			});
			
		} else {
			// Não é armadura - mostrar espaço/peso como antes
			
			// Tentar usar labels do sistema primeiro (mais confiável)
			finalText = item.labels?.espaco || 
			            item.labels?.space ||
			            '';
			
			// Se não tiver label formatado, construir manualmente
			if (!finalText || finalText === '' || finalText === '-') {
				const espaco = system.espaco || system.space || system.peso || system.weight || {};
				
				// Formatar espaço/peso
				let espacoText = '';
				if (typeof espaco === 'object' && espaco !== null) {
					const espacoValue = espaco.value !== undefined ? espaco.value : 
					                  (espaco.total !== undefined ? espaco.total : null);
					if (espacoValue !== null && espacoValue !== undefined && espacoValue !== '') {
						espacoText = String(espacoValue);
					}
				} else if (espaco !== null && espaco !== undefined && espaco !== '') {
					espacoText = String(espaco);
				}
				
				finalText = espacoText || '-';
				
				console.log("T20 Items Manager | Estatísticas formatadas do equipamento:", finalText, "de", {
					espacoText
				});
			}
		}
		
		$statsText.text(finalText || '-');
	}
	
	/**
	 * Configura a rolagem do dado ao clicar no ícone do equipamento
	 */
	setupEquipmentIconRoll($item, item) {
		const $equipmentIcon = $item.find('.equipment-icon');
		if ($equipmentIcon.length === 0) return;
		
		$equipmentIcon.addClass('rollable item-image').attr({
			'data-item-id': item.id,
			'data-item-type': 'equipamento'
		});
	}
	
	/**
	 * Adiciona painel expansível ao equipamento com informações detalhadas
	 */
	addEquipmentTooltip($item, item) {
		if ($item.find('.equipment-details-panel').length > 0) return;
		
		const $equipmentItemRow = $item.find('.equipment-item-row');
		if ($equipmentItemRow.length === 0) return;
		
		let descricao = '';
		if (item.system?.descricao?.value) {
			descricao = item.system.descricao.value;
		} else if (item.system?.description?.value) {
			descricao = item.system.description.value;
		}
		
		const $descContainer = $('<div>').addClass('equipment-details-description');
		
		// Obter estatísticas formatadas
		const $statsText = $item.find('.equipment-stats-text');
		const statsText = $statsText.text() || '-';
		
		const $panel = $('<div>')
			.addClass('equipment-details-panel')
			.html(`
				<div class="equipment-details-header">
					<div class="equipment-details-title">${this.escapeHtml(item.name)}</div>
				</div>
				<div class="equipment-details-row">
					<span class="equipment-details-label">Estatísticas:</span>
					<span class="equipment-details-value">${this.escapeHtml(statsText)}</span>
				</div>
			`)
			.append($descContainer);
		
		$equipmentItemRow.after($panel);
		
		let enriched = false;
		
		const $equipmentName = $item.find('.equipment-name');
		$equipmentName.off('click.equipment-expand').on('click.equipment-expand', async (event) => {
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
	 * Handler para clique no ícone do equipamento
	 */
	async onEquipmentIconClick(event) {
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
			console.warn("T20 Items Manager | Não foi possível encontrar o ID do item");
			return;
		}
		
		const item = this.actor.items.get(itemId);
		if (!item) {
			console.warn("T20 Items Manager | Item não encontrado:", itemId);
			return;
		}
		
		if (item.type !== 'equipamento') {
			console.warn("T20 Items Manager | Item não é um equipamento:", item.type);
			return;
		}
		
		try {
			// Tentar usar o equipamento do sistema T20
			if (typeof item.use === "function") {
				await item.use();
				return;
			}

			// Alternativa: se existir método roll padrão, usar
			if (typeof item.roll === "function") {
				await item.roll();
				return;
			}

			// Fallback: Mostrar o card do equipamento no chat
			const speaker = ChatMessage.getSpeaker({actor: this.actor});
			
			let content = '';
			try {
				const possibleTemplates = [
					"systems/tormenta20/templates/chat/item-card.hbs",
					"systems/tormenta20/templates/chat/equipment-card.hbs",
					"systems/tormenta20/templates/items/equipamento-chat.hbs"
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
					const img = item.img || 'icons/svg/mystery-man.svg';
					
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
							${descricao ? `<div class="item-description" style="margin-top: 8px;">${descricao}</div>` : ''}
						</div>
					</div>`;
				}
			} catch (templateError) {
				console.warn("T20 Items Manager | Erro ao renderizar template, usando card simples:", templateError);
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
			console.error("T20 Items Manager | Erro ao exibir equipamento no chat:", error);
			ui.notifications.error(`Erro ao exibir ${item.name}`);
		} finally {
			// Remover classe de processamento após 500ms
			setTimeout(() => {
				$(event.currentTarget).removeClass('processing');
			}, 500);
		}
	}
	
	/**
	 * Handler para clique no nome do equipamento (expande/contrai descrição)
	 */
	onEquipmentNameClick(event) {
		event.preventDefault();
		event.stopPropagation();
		
		const $name = $(event.currentTarget);
		const $item = $name.closest('.equipment-item');
		
		if ($item.length === 0) return;
		
		const itemId = $item.data('item-id') || $item.attr('data-item-id');
		if (!itemId) return;
		
		const item = this.actor.items.get(itemId);
		if (!item) return;
		
		// Toggle expanded class
		$item.toggleClass('expanded');
		
		// Enriquecer descrição na primeira expansão
		const $descContainer = $item.find('.equipment-details-description');
		if ($item.hasClass('expanded') && $descContainer.length > 0 && $descContainer.html().trim() === '') {
			let descricao = '';
			if (item.system?.descricao?.value) {
				descricao = item.system.descricao.value;
			} else if (item.system?.description?.value) {
				descricao = item.system.description.value;
			}
			
			if (descricao) {
				TextEditor.enrichHTML(descricao, {
					async: true,
					relativeTo: this.actor
				}).then(html => {
					$descContainer.html(html);
				}).catch(e => {
					$descContainer.html(this.escapeHtml(descricao));
				});
			}
		}
	}
	
	/**
	 * Handler para toggle de equipar/desequipar
	 */
	async onEquipmentToggleClick(event) {
		event.preventDefault();
		event.stopPropagation();
		
		const $btn = $(event.currentTarget);
		const $item = $btn.closest('.equipment-item');
		
		if ($item.length === 0) return;
		
		const itemId = $item.data('item-id') || $item.attr('data-item-id');
		if (!itemId) return;
		
		const item = this.actor.items.get(itemId);
		if (!item) return;
		
		const system = item.system || {};
		const currentEquipped = system.equipped || system.equipado || false;
		const newEquipped = !currentEquipped;
		const newTipoUso = newEquipped ? 'Vestido' : 'Não Vestido';
		
		try {
			// Atualizar o item - sincronizar equipado/equipped
			const updateData = {
				'system.equipped': newEquipped,
				'system.equipado': newEquipped,
				'system.tipoUso': newTipoUso
			};
			
			await item.update(updateData);
			
			// Atualizar visualmente
			setTimeout(() => {
				this.setupEquipmentSection();
			}, 100);
		} catch (error) {
			console.error("T20 Items Manager | Erro ao equipar/desequipar:", error);
			ui.notifications.error(`Erro ao ${newEquipped ? 'equipar' : 'desequipar'} ${item.name}`);
		}
	}
	
	/**
	 * Escapa HTML para prevenir XSS
	 */
	escapeHtml(text) {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}
}

export class InventoryManager {
	constructor(sheet) {
		this.sheet = sheet;
		this.actor = sheet.actor;
		this.element = sheet.element;
	}

	/**
	 * Configura a seção de inventário
	 */
	setupInventorySection() {
		if (!this.element || !this.element.length) return;

		const $inventoryList = this.element.find('.inventory-list-custom');
		if ($inventoryList.length === 0) return;

		const $inventoryItems = $inventoryList.find('.inventory-item');

		$inventoryItems.each((index, element) => {
			const $item = $(element);
			const itemId = $item.data('item-id') || $item.attr('data-item-id');

			if (!itemId) {
				console.warn("T20 Items Manager | Item ID não encontrado para inventário");
				return;
			}

			// Adicionar delay escalonado para animação de entrada
			$item.css('animation-delay', `${index * 0.05}s`);

			const item = this.actor.items.get(itemId);
			if (!item) {
				console.warn("T20 Items Manager | Item não encontrado:", itemId);
				return;
			}

			// Aceitar todos os tipos de itens de inventário (geral, consumivel, loot, etc)
			// Não filtrar por tipo específico

			// Log completo do item do inventário
			const system = item.system || {};
			console.log("T20 Items Manager | Estrutura completa do item (inventário):", {
				name: item.name,
				type: item.type,
				labels: item.labels,
				labelsKeys: Object.keys(item.labels || {}),
				systemKeys: Object.keys(system),
				system: JSON.parse(JSON.stringify(system)), // Deep clone para ver tudo
				qtd: system.qtd,
				peso: system.peso,
				espaco: system.espaco,
				preco: system.preco,
				descricao: system.descricao,
				description: system.description
			});

			// Formatar estatísticas
			this.formatInventoryStats($item, item);

			// Configurar rolagem do dado ao clicar no ícone
			this.setupInventoryIconRoll($item, item);

			// Adicionar painel expansível com descrição
			this.addInventoryTooltip($item, item);
		});
	}

	/**
	 * Formata as estatísticas do item do inventário
	 */
	formatInventoryStats($item, item) {
		const $statsText = $item.find('.inventory-stats-text');

		if ($statsText.length === 0) {
			console.warn("T20 Items Manager | Elemento .inventory-stats-text não encontrado");
			return;
		}

		const system = item.system || {};

		// Montar informações: quantidade, peso, espaço, preço
		const parts = [];

		if (system.qtd !== undefined && system.qtd !== null && system.qtd !== '') {
			parts.push(`Qtd: ${system.qtd}`);
		}

		if (system.peso !== undefined && system.peso !== null && system.peso !== '') {
			parts.push(`Peso: ${system.peso}`);
		}

		if (system.espaco !== undefined && system.espaco !== null && system.espaco !== '') {
			parts.push(`Espaço: ${system.espaco}`);
		}

		if (system.preco !== undefined && system.preco !== null && system.preco !== '') {
			parts.push(`Preço: ${system.preco}`);
		}

		const finalText = parts.join(' | ') || '-';
		$statsText.text(finalText);
	}

	/**
	 * Configura a rolagem do dado ao clicar no ícone do inventário
	 */
	setupInventoryIconRoll($item, item) {
		const $inventoryIcon = $item.find('.inventory-icon');
		if ($inventoryIcon.length === 0) return;

		$inventoryIcon.addClass('rollable item-image').attr({
			'data-item-id': item.id,
			'data-item-type': 'consumivel'
		});
	}

	/**
	 * Adiciona painel expansível ao item do inventário com informações detalhadas
	 */
	addInventoryTooltip($item, item) {
		if ($item.find('.inventory-details-panel').length > 0) return;

		const $inventoryItemRow = $item.find('.inventory-item-row');
		if ($inventoryItemRow.length === 0) return;

		let descricao = '';
		if (item.system?.descricao?.value) {
			descricao = item.system.descricao.value;
		} else if (item.system?.description?.value) {
			descricao = item.system.description.value;
		}

		const $descContainer = $('<div>').addClass('inventory-details-description');

		// Obter estatísticas formatadas
		const $statsText = $item.find('.inventory-stats-text');
		const statsText = $statsText.text() || '-';

		const $panel = $('<div>')
			.addClass('inventory-details-panel')
			.html(`
				<div class="inventory-details-header">
					<div class="inventory-details-title">${this.escapeHtml(item.name)}</div>
				</div>
				<div class="inventory-details-row">
					<span class="inventory-details-label">Estatísticas:</span>
					<span class="inventory-details-value">${this.escapeHtml(statsText)}</span>
				</div>
			`)
			.append($descContainer);

		$inventoryItemRow.after($panel);

		let enriched = false;

		const $inventoryName = $item.find('.inventory-name');
		$inventoryName.off('click.inventory-expand').on('click.inventory-expand', async (event) => {
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
	 * Handler para clique no ícone do inventário
	 */
	async onInventoryIconClick(event) {
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
			console.warn("T20 Items Manager | Não foi possível encontrar o ID do item");
			return;
		}

		const item = this.actor.items.get(itemId);
		if (!item) {
			console.warn("T20 Items Manager | Item não encontrado:", itemId);
			return;
		}

		// Aceitar todos os tipos de itens de inventário
		// Não filtrar por tipo específico

		try {
			// Tentar usar o item do sistema T20
			if (typeof item.use === "function") {
				await item.use();
				return;
			}

			// Alternativa: se existir método roll padrão, usar
			if (typeof item.roll === "function") {
				await item.roll();
				return;
			}

			// Fallback: Mostrar o card do item no chat
			const speaker = ChatMessage.getSpeaker({actor: this.actor});

			let content = '';
			try {
				const possibleTemplates = [
					"systems/tormenta20/templates/chat/item-card.hbs",
					"systems/tormenta20/templates/chat/consumable-card.hbs",
					"systems/tormenta20/templates/items/consumivel-chat.hbs",
					"systems/tormenta20/templates/chat/general-item-card.hbs"
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
					const img = item.img || 'icons/svg/mystery-man.svg';

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
							${descricao ? `<div class="item-description" style="margin-top: 8px;">${descricao}</div>` : ''}
						</div>
					</div>`;
				}
			} catch (templateError) {
				console.warn("T20 Items Manager | Erro ao renderizar template, usando card simples:", templateError);
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
			console.error("T20 Items Manager | Erro ao exibir item do inventário no chat:", error);
			ui.notifications.error(`Erro ao exibir ${item.name}`);
		} finally {
			// Remover classe de processamento após 500ms
			setTimeout(() => {
				$(event.currentTarget).removeClass('processing');
			}, 500);
		}
	}

	/**
	 * Handler para clique no nome do inventário (expande/contrai descrição)
	 */
	onInventoryNameClick(event) {
		event.preventDefault();
		event.stopPropagation();

		const $name = $(event.currentTarget);
		const $item = $name.closest('.inventory-item');

		if ($item.length === 0) return;

		const itemId = $item.data('item-id') || $item.attr('data-item-id');
		if (!itemId) return;

		const item = this.actor.items.get(itemId);
		if (!item) return;

		// Toggle expanded class
		$item.toggleClass('expanded');

		// Enriquecer descrição na primeira expansão
		const $descContainer = $item.find('.inventory-details-description');
		if ($item.hasClass('expanded') && $descContainer.length > 0 && $descContainer.html().trim() === '') {
			let descricao = '';
			if (item.system?.descricao?.value) {
				descricao = item.system.descricao.value;
			} else if (item.system?.description?.value) {
				descricao = item.system.description.value;
			}

			if (descricao) {
				TextEditor.enrichHTML(descricao, {
					async: true,
					relativeTo: this.actor
				}).then(html => {
					$descContainer.html(html);
				}).catch(e => {
					$descContainer.html(this.escapeHtml(descricao));
				});
			}
		}
	}

	/**
	 * Escapa HTML para prevenir XSS
	 */
	escapeHtml(text) {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}
}
