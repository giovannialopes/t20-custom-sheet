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
		
		// Se não tiver label formatado, construir manualmente
		if (!finalText || finalText === '' || finalText === '-') {
			const system = item.system || {};
			
			// Debug temporário para ver estrutura completa
			console.log("T20 Items Manager | Estrutura completa do item (arma):", {
				name: item.name,
				labels: item.labels,
				labelsKeys: Object.keys(item.labels || {}),
				systemKeys: Object.keys(system),
				system: JSON.parse(JSON.stringify(system)), // Deep clone para ver tudo
				ataque: system.ataque,
				dano: system.dano,
				critico: system.critico
			});
			
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
			console.log("T20 Items Manager | Estrutura completa do item (equipamento):", {
				name: item.name,
				labels: item.labels,
				labelsKeys: Object.keys(item.labels || {}),
				systemKeys: Object.keys(item.system || {}),
				system: JSON.parse(JSON.stringify(item.system || {})), // Deep clone para ver tudo
				tipo: item.system?.tipo,
				subtipo: item.system?.subtipo,
				categoria: item.system?.categoria,
				defesa: item.system?.defesa,
				penalidade: item.system?.penalidade,
				espaco: item.system?.espaco,
				peso: item.system?.peso
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
	 * Para armaduras: mostra defesa, penalidade e tipo (Leve/Pesada/etc)
	 */
	formatEquipmentStats($item, item) {
		const $statsText = $item.find('.equipment-stats-text');
		
		if ($statsText.length === 0) {
			console.warn("T20 Items Manager | Elemento .equipment-stats-text não encontrado");
			return;
		}
		
		const system = item.system || {};
		
		// Verificar se é uma armadura
		// O sistema T20 geralmente tem um campo tipo ou categoria que indica se é armadura
		const isArmadura = system.tipo === 'armadura' || 
		                   system.type === 'armadura' ||
		                   system.categoria === 'armadura' ||
		                   system.category === 'armadura' ||
		                   (item.labels?.tipo && item.labels.tipo.toLowerCase().includes('armadura')) ||
		                   (item.labels?.type && item.labels.type.toLowerCase().includes('armadura')) ||
		                   (item.labels?.categoria && item.labels.categoria.toLowerCase().includes('armadura'));
		
		let finalText = '';
		
		if (isArmadura) {
			// É uma armadura - mostrar defesa, penalidade e tipo
			
			// Buscar defesa da armadura
			let defesaValue = null;
			if (system.defesa) {
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
			
			// Buscar penalidade
			let penalidadeValue = null;
			if (system.penalidade) {
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
			
			// Buscar tipo de armadura (Leve, Pesada, etc) - campo "Tipo" do sistema
			// O campo "Tipo" pode ser "Armadura Leve", "Armadura Pesada", etc
			let tipoArmadura = '';
			if (system.tipo) {
				// Se for objeto, pegar o valor
				if (typeof system.tipo === 'object') {
					tipoArmadura = system.tipo.value || system.tipo.label || system.tipo.name || '';
				} else {
					tipoArmadura = String(system.tipo);
				}
			}
			
			// Fallback para subtipo/categoria
			if (!tipoArmadura) {
				if (system.subtipo) {
					tipoArmadura = String(system.subtipo);
				} else if (system.subtype) {
					tipoArmadura = String(system.subtype);
				} else if (system.categoria) {
					tipoArmadura = String(system.categoria);
				} else if (system.category) {
					tipoArmadura = String(system.category);
				}
			}
			
			// Tentar usar labels se disponível
			if (!tipoArmadura && item.labels?.tipo) {
				tipoArmadura = String(item.labels.tipo);
			} else if (!tipoArmadura && item.labels?.subtipo) {
				tipoArmadura = String(item.labels.subtipo);
			} else if (!tipoArmadura && item.labels?.subtype) {
				tipoArmadura = String(item.labels.subtype);
			} else if (!tipoArmadura && item.labels?.categoria) {
				tipoArmadura = String(item.labels.categoria);
			}
			
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
			
			// Verificar se está equipado (vestido)
			// Pode estar em equipped/equipado ou tipoUso === 'Vestido'
			const isEquipped = system.equipped === true || 
			                   system.equipado === true || 
			                   tipoUso === 'Vestido' || 
			                   tipoUso === 'vestido' ||
			                   tipoUso === 'Vestido/a';
			
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
			
			// Montar texto final: "Tipo: Armadura Leve | Defesa: +5 | Penalidade: -2 | Uso: Vestido"
			const parts = [];
			if (tipoArmadura) {
				parts.push(`Tipo: ${tipoArmadura}`);
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
			
			// Atualizar estado do botão de equipar/desequipar
			const $toggleBtn = $item.find('.equipment-toggle-btn');
			if ($toggleBtn.length > 0) {
				if (isEquipped) {
					$toggleBtn.addClass('equipped').attr('title', 'Desequipar');
					$toggleBtn.find('i').removeClass('fa-hand-paper').addClass('fa-check-circle');
				} else {
					$toggleBtn.removeClass('equipped').attr('title', 'Equipar');
					$toggleBtn.find('i').removeClass('fa-check-circle').addClass('fa-hand-paper');
				}
			}
			
			console.log("T20 Items Manager | Estatísticas formatadas da armadura:", finalText, "de", {
				tipoArmadura,
				defesaValue,
				penalidadeValue,
				tipoUso,
				isEquipped,
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
	 * Escapa HTML para prevenir XSS
	 */
	escapeHtml(text) {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}
}

