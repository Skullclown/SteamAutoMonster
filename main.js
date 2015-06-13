// Steam Monster Game Auto


var DASHBOARD = '\
	<div id="SAM" style="position: absolute; top: 20px; right: 20px; min-height: 150px; min-width: 200px; padding: 15px; z-index: 9999999; background-color: #2b2d30; color: #FFF; border: 1px solid #82827f; font-family: \'Press Start 2P\', \'Lucida Console\', Consolas, Arial;">\
		<div class="title_teamdps">Status:</div>\
		<div id="SAM_status" style="font-size: 10px; margin-top: 6px;">Loading...</div>\
	</div>';

/* Reusable abilities */
var ABILITIES = {
	"MORALE_BOOSTER": 5,
	"LUCK_CHARM": 6,
	"MEDICS": 7,
	"METAL_DETECTOR": 8,
	"REDUCE_CD": 9,
	"NUKE": 10,
	"CLUSTER_BOMB": 11,
	"NAPALM": 12
};

/* One-time use items */
var ITEMS = {
	"REVIVE": 13,
	"CRIPPLE_SPAWNER": 14,
	"CRIPPLE_MONSTER": 15,
	"MAX_ELEMENTAL": 16,
	"GOLD_RAIN": 17,
	"CRIT": 18,
	"PUMPED_UP": 19,
	"THROW_MONEY": 20,
	"GOD_MODE": 21,
	"TREASURE": 22,
	"STEAL_HEALTH": 23,
	"REFLECT_DAMAGE": 24
};

window.SAM = window.SteamAutoMonster = {
	/* Settings */
	settings: {
		debug: true,
		
		tickRate: 10, // ticks/s
		clickRate: 0, // clicks/s
		
		healPercentage: 30, // At what percentage health we should use our medics (if it's available)
		
		// Abilities to immediate use when on CD
		abilitiesToUseOnCD: [ABILITIES.LUCK_CHARM]
	},
	
	/* Status */
	status: {
		text: "Loading...",
	},
	
	/* Intervals */
	intervals: {
		tick: null,
		click: null
	},
	
	/* Init */
	start: function() {
		this.setStatus("Initializing...");
		
		// Run intervals with proper bound context "this"
		if(this.settings.tickRate > 0)
			this.intervals.tick = window.setInterval(this.tick.bind(window.SteamAutoMonster), 1000 / this.settings.tickRate);
		
		if(this.settings.clickRate > 0)
			this.intervals.click = window.setInterval(this.game.do.click.bind(window.SteamAutoMonster), 1000 / this.settings.clickRate);
	},
	
	reduceResourceUsage: function() {
		// Disable particle effects
		window.g_Minigame.CurrentScene().DoClickEffect = function() {};
		window.g_Minigame.CurrentScene().SpawnEmitter = function(emitter) {
			emitter.emit = false;
			return emitter;
		}
		
		// Disable enemy flinching
		window.CEnemy.prototype.TakeDamage = function() {};
		window.CEnemySpawner.prototype.TakeDamage = function() {};
		window.CEnemyBoss.prototype.TakeDamage = function() {};
	},
	
	/*
		Stop/reset SAM
	*/
	stop: function() {
		this.stopTick();
		this.stopClick();
	},
	
	stopTick: function() {
		clearInterval(this.intervals.tick);
		this.intervals.tick = null;
	},
	
	stopClick: function() {
		clearInterval(this.intervals.click);
		this.intervals.click = null;
	},
	
	
	/*
		Control our app's flow
	*/
	
	/* Set our status */
	setStatus: function(s) {
		this.status.text = s;
		
		if(this.settings.debug === true)
			console.log("Status: " + s);
	},
	
	setTickRate: function(r) {
		this.stopTick();
		this.settings.tickRate = r;
		
		if(r !== 0) // If it's 0, we probably meant to call stop()
			this.intervals.tick = window.setInterval(this.tick.bind(window.SteamAutoMonster), 1000/this.settings.tickRate);
	},
	
	setClickRate: function(r) {
		this.stopClick();
		this.settings.clickRate = r;
		
		if(r !== 0) // If it's 0, we probably meant to call stop()
			this.intervals.click = window.setInterval(this.game.do.click.bind(window.SteamAutoMonster), 1000/this.settings.clickRate);
	},
	
	
	/*
		tick() loop
	*/
	tick: function() {
		this.setStatus("Running game tick...");
		
		// Set our game's click/tickrate every tick - it usually decreases over time and is set to 1.1k on .mousemove(), anti-autoclicker
		window.g_msTickRate = 1100;
		
		// Am I dead?
		if(this.game.ask.isDead()) {
			if(this.game.ask.canRespawn.call(this)) {
				this.game.do.respawn.call(this);
			}
		} else {
			// Added this part in the else, to be more efficient with our loops
			// At this point, we're alive & kicking :]
			
			// Should we heal?
			if(this.game.ask.shouldWeHeal.call(this)) {
				this.setStatus("We need to heal!");
				this.game.do.heal.call(this);
			}
			
			// Use abilities on CD
			this.game.do.useAllAbilities.call(this);
		}
	},
	
	/* Game interaction */
	game: {
		/* Get info from the game */
		ask: {
			// Am I dead?
			isDead: function() {
				return (g_Minigame.CurrentScene().m_bIsDead);
			},
			
			// Have 5 seconds passed since I died?
			canRespawn: function() {
				return (((g_Minigame.CurrentScene().m_rgPlayerData.time_died * 1000) + 5000) < (new Date().getTime()));
			},
			
			// Should I use my medics?
			shouldWeHeal: function() {
				var maxHP = g_Minigame.CurrentScene().m_rgPlayerTechTree.max_hp;
				var hpPercent = g_Minigame.CurrentScene().m_rgPlayerData.hp / maxHP;
				
				return (hpPercent < (this.settings.healPercentage / 100));
			},
			
			hasPurchasedAbility: function(abilityId) {
				return (1 << abilityId) & g_Minigame.CurrentScene().m_rgPlayerTechTree.unlocked_abilities_bitfield;
			},
			
			isAbilityCoolingDown: function(abilityId) {
				return (g_Minigame.CurrentScene().GetCooldownForAbility(abilityId) > 0);
			},
			
			canUseAbility: function(abilityId) {
				return (this.game.ask.hasPurchasedAbility(abilityId) && !this.game.ask.isAbilityCoolingDown(abilityId))
			}
		},
		
		/* Make the game do something */
		do: {
			respawn: function() { this.setStatus("Respawning."); RespawnPlayer(); },
			
			heal: function() {
				// check if Medics is purchased and cooled down
				if (this.game.ask.canUseAbility(ABILITIES.MEDICS)) {
					this.setStatus("Healing.");
					
					this.game.do.useAbility(ABILITIES.MEDICS);
				}
			},
			
			// Use all abilities that should be used on cooldown
			useAllAbilities: function() {
				for(var i = 0, len = this.settings.abilitiesToUseOnCD.length; i < len; i++) {
					var abilityId = this.settings.abilitiesToUseOnCD[i];
					
					if (this.game.ask.canUseAbility.call(this, abilityId)) {
						this.setStatus("Using ability #" + abilityId + ".");
						
						this.game.do.useAbility(abilityId);
					}
				}
			},
			
			useAbility: function(abilityId) {
				var elem = document.getElementById('ability_' + abilityId);
				
				if (elem && elem.childElements() && elem.childElements().length >= 1) {
					g_Minigame.CurrentScene().TryAbility(document.getElementById('ability_' + abilityId).childElements()[0]);
				}
			},
			
			click: function() {
				g_Minigame.m_CurrentScene.DoClick({
					data: {
						getLocalPosition: function() {
							var enemy = g_Minigame.m_CurrentScene.GetEnemy(
								g_Minigame.m_CurrentScene.m_rgPlayerData.current_lane,
								g_Minigame.m_CurrentScene.m_rgPlayerData.target
							),
							laneOffset = enemy.m_nLane * 440;

							return {
								x: enemy.m_Sprite.position.x - laneOffset,
								y: enemy.m_Sprite.position.y - 52
							}
						}
					}
				});
			}
		}
	}
};

window.SteamAutoMonster.start();