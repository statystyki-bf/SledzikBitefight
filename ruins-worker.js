// ==========================================
// ruins-worker.js
// CZYSTY SILNIK WALKI BITEFIGHT W TLE
// ==========================================

const UNIT_WEIGHTS = [2, 3, 4, 7, 10, 15, 18, 30]; 
const UNIT_COSTS = [10, 15, 20, 35, 50, 75, 90, 150]; 

self.onmessage = function(e) {
    const data = e.data;
    const maxArmyStrength = 10 + (data.layer * 10);
    let bestFormations = [];
    
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

    if (data.mode === 'best') {
        bestFormations.sort((a, b) => a.cost - b.cost || a.rounds - b.rounds);
    } else {
        bestFormations.sort((a, b) => a.lost - b.lost || a.cost - b.cost);
    }

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

        if (allyDamagePool === 0) return { won: false, rounds };
        if (enemyDamagePool === 0) return { won: true, survivors: alliesAlive, rounds };

        applyDamage(enemiesAlive, allyDamagePool);
        applyDamage(alliesAlive, enemyDamagePool);
        
        rounds++;
    }
    return { won: false, rounds: 50 }; 
}

function getArmyDamage(army, isAlly) {
    let dmg = 0;
    for(let i=0; i<army.length; i++) {
        dmg += army[i] * (isAlly ? (i + 1) * 3 : (i + 1) * 2); 
    }
    return dmg;
}

function applyDamage(army, damagePool) {
    let remainingDamage = damagePool;
    for(let i=0; i<army.length; i++) {
        if(army[i] > 0) {
            let unitHp = (i + 1) * 10; 
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

function generateArmies(maxStr, limits) {
    let armies = [];
    for(let i=0; i < 5000; i++) { 
        let currentArmy = [0,0,0,0,0,0,0,0];
        let currentStr = 0;
        
        while(currentStr < maxStr) {
            let randomTier = Math.floor(Math.random() * 8);
            if(currentStr + UNIT_WEIGHTS[randomTier] <= maxStr && currentArmy[randomTier] < limits[randomTier]) {
                currentArmy[randomTier]++;
                currentStr += UNIT_WEIGHTS[randomTier];
            } else {
                break; 
            }
        }
        armies.push(currentArmy);
    }
    return armies;
}
