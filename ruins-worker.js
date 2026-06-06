// ==========================================
// ruins-worker.js
// CZYSTY SILNIK WALKI BITEFIGHT W TLE (Zaktualizowany)
// Zawiera poprawione, realne statystyki bazowe HP/Ataku z silnika gry
// ==========================================

const UNIT_WEIGHTS = [2, 3, 4, 7, 10, 15, 18, 30]; 
const UNIT_COSTS = [10, 15, 20, 35, 50, 75, 90, 150]; 

// Realne statystyki Ataku i Zdrowia dla Twojej armii (Od T1 do T8)
const ALLY_ATK = [8, 3, 6, 7, 9, 12, 14, 30];
const ALLY_HP = [2, 5, 6, 4, 5, 12, 8, 90];

// Realne statystyki Ataku i Zdrowia dla wroga 
// Skieleton, Zombie, Cultist, Bonewing, Bloated, Wraith, Revenant, Bone Giant, Broodmother, Lich
const ENEMY_ATK = [3, 2, 5, 6, 1, 7, 8, 10, 9, 40];
const ENEMY_HP = [4, 7, 1, 3, 10, 2, 12, 25, 18, 25];

self.onmessage = function(e) {
    const data = e.data;
    const maxArmyStrength = 10 + (data.layer * 10);
    let bestFormations = [];
    
    // Generowanie zoptymalizowane pod wysokie poziomy (wymusza na starcie wstawienie najmocniejszych tierów)
    const validArmies = generateArmies(maxArmyStrength, data.maxAllies);
    
    for(let i = 0; i < validArmies.length; i++) {
        let army = validArmies[i];
        let simResult = simulateBattle(army, [...data.enemies]);
        
        if (i % 500 === 0) {
            self.postMessage({ status: 'progress', percent: Math.round((i / validArmies.length) * 100) });
        }

        if (simResult.won) {
            let cost = calculateCost(army, simResult.survivors);
            let lostUnits = calculateLostUnits(army, simResult.survivors);
            
            bestFormations.push({
                army: [...army],
                cost: cost,
                lost: lostUnits,
                rounds: simResult.rounds
            });
        }
    }

    // Sortowanie według wymaganego trybu
    if (data.mode === 'best') {
        bestFormations.sort((a, b) => a.cost - b.cost || a.rounds - b.rounds);
    } else {
        bestFormations.sort((a, b) => a.lost - b.lost || a.cost - b.cost);
    }

    // Odcięcie do TOP 10, aby nie zacinać interfejsu w przeglądarce
    self.postMessage({ 
        status: 'done', 
        results: bestFormations.slice(0, 10) 
    });
};

function calculateCost(originalArmy, survivingArmy) {
    let totalCost = 0;
    for(let i = 0; i < 8; i++) {
        let lost = originalArmy[i] - survivingArmy[i];
        if (lost > 0) totalCost += lost * UNIT_COSTS[i];
    }
    return totalCost;
}

function calculateLostUnits(originalArmy, survivingArmy) {
    let lost = 0;
    for(let i = 0; i < 8; i++) {
        lost += Math.max(0, originalArmy[i] - survivingArmy[i]);
    }
    return lost;
}

function simulateBattle(allyCounts, enemyCounts) {
    let rounds = 0;
    let alliesAlive = [...allyCounts];
    let enemiesAlive = [...enemyCounts];
    
    while (rounds < 50) {
        let allyDamagePool = getArmyDamage(alliesAlive, true);
        let enemyDamagePool = getArmyDamage(enemiesAlive, false);

        if (allyDamagePool <= 0) return { won: false, rounds };
        if (enemyDamagePool <= 0) return { won: true, survivors: alliesAlive, rounds };

        applyDamage(enemiesAlive, allyDamagePool, false);
        applyDamage(alliesAlive, enemyDamagePool, true);
        
        rounds++;
    }
    return { won: false, rounds: 50 }; 
}

function getArmyDamage(army, isAlly) {
    let dmg = 0;
    for(let i=0; i<army.length; i++) {
        if(army[i] > 0) {
            dmg += army[i] * (isAlly ? ALLY_ATK[i] : ENEMY_ATK[i]); 
        }
    }
    return dmg;
}

function applyDamage(army, damagePool, isAlly) {
    let remainingDamage = damagePool;
    for(let i=0; i<army.length; i++) {
        if(army[i] > 0) {
            let unitHp = isAlly ? ALLY_HP[i] : ENEMY_HP[i]; 
            let unitsKilled = Math.floor(remainingDamage / unitHp);
            
            if (unitsKilled >= army[i]) {
                remainingDamage -= army[i] * unitHp;
                army[i] = 0;
            } else {
                army[i] -= unitsKilled;
                remainingDamage = 0;
            }
        }
        if (remainingDamage <= 0) break;
    }
}

// Sprytny generator - buduje armię nie tylko losowo, ale wymusza solidne, kosztowne układy
function generateArmies(maxStr, limits) {
    let armies = [];
    
    // HEURYSTYKA 1: Czyste konfiguracje z każdego Tieru (szczególnie T8 i T7 dają pewne wygrane wyżej)
    for(let t = 7; t >= 0; t--) {
        let currentArmy = [0,0,0,0,0,0,0,0];
        let possibleAmmount = Math.floor(maxStr / UNIT_WEIGHTS[t]);
        let actualAmount = Math.min(possibleAmmount, limits[t]);
        if (actualAmount > 0) {
            currentArmy[t] = actualAmount;
            armies.push([...currentArmy]);
        }
    }

    // HEURYSTYKA 2: Mieszanki wysokiego ryzyka (np Pół T8 i Pół T7)
    let halfT8 = Math.floor((maxStr / 2) / UNIT_WEIGHTS[7]);
    let halfT7 = Math.floor((maxStr / 2) / UNIT_WEIGHTS[6]);
    if (limits[7] >= halfT8 && limits[6] >= halfT7) {
        armies.push([0,0,0,0,0,0, halfT7, halfT8]);
    }

    // Losowe mutacje by znaleźć ewentualnie najtańszy mix
    for(let i=0; i < 10000; i++) { 
        let currentArmy = [0,0,0,0,0,0,0,0];
        let currentStr = 0;
        
        let availableTiers = [7, 6, 5, 4, 3, 2, 1, 0];
        if (Math.random() > 0.5) availableTiers.sort(() => Math.random() - 0.5); // czasem losujemy priorytet od dołu

        for (let tier of availableTiers) {
            let maxPossible = Math.floor((maxStr - currentStr) / UNIT_WEIGHTS[tier]);
            let take = Math.floor(Math.random() * (Math.min(maxPossible, limits[tier]) + 1));
            
            // na wysokie poziomy faworyzujemy potężne jednostki jeśli są
            if (tier >= 6 && Math.random() > 0.3) take = Math.min(maxPossible, limits[tier]); 

            if (take > 0) {
                currentArmy[tier] += take;
                currentStr += take * UNIT_WEIGHTS[tier];
            }
        }
        
        armies.push(currentArmy);
    }
    return armies;
}
