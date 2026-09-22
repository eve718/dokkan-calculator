// Temporary DOM-shim harness: loads the REAL app modules and verifies
//  (a) enemy input values survive defeat/resurrect re-renders (for ALL enemies
//      of the phase, including the defeated/resurrected one), and
//  (b) the recalculation skips defeated enemies.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

const registry = new Map();       // id -> element
const sessionStorageMap = new Map();
function EventCtor(type) { this.type = type; this.bubbles = false; }

function queryIn(rootEl, sel) {
    sel = String(sel || '');
    let m = sel.match(/^\[id="([^"]+)"\]$/) || sel.match(/^#([A-Za-z0-9_-]+)$/);
    if (m) {
        const wanted = m[1] || m[2];
        const walkId = (node) => {
            for (const c of node.children || []) {
                if (c.id === wanted) return c;
                const f = walkId(c);
                if (f) return f;
            }
            return null;
        };
        return walkId(rootEl);
    }
    m = sel.match(/^\.([A-Za-z0-9_-]+)$/);
    if (m) {
        const wanted = m[1];
        const walkCls = (node) => {
            for (const c of node.children || []) {
                if (String(c.className || '').split(/\s+/).includes(wanted)) return c;
                const f = walkCls(c);
                if (f) return f;
            }
            return null;
        };
        return walkCls(rootEl);
    }
    return null;
}

function makeEl(tag) {
    const listeners = {};
    const el = {
        tagName: String(tag || 'div').toUpperCase(),
        children: [],
        style: {},
        dataset: {},
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        textContent: '', className: '', value: '',
        checked: false, type: '', placeholder: '', min: '', max: '',
        src: '', alt: '', loading: '', decoding: '', htmlFor: '',
        appendChild(child) {
            if (!child) return child;
            this.children.push(child);
            child.parentElement = this;
            if (child.id) registry.set(child.id, child);
            return child;
        },
        querySelector(sel) { return queryIn(this, sel); },
        querySelectorAll(sel) {
            sel = String(sel || '');
            if (/^[a-zA-Z]+$/.test(sel)) {
                const out = [];
                const walkTag = (node) => (node.children || []).forEach(c => {
                    if (c.tagName === sel.toUpperCase()) out.push(c);
                    walkTag(c);
                });
                walkTag(this);
                return out;
            }
            const r = queryIn(this, sel);
            return r ? [r] : [];
        },
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
        dispatchEvent(evt) {
            if (evt) evt.target = this;
            (listeners[evt && evt.type] || []).forEach(fn => fn.call(this, evt));
            return true;
        },
        setAttribute() {}, getAttribute: () => null, closest: () => null, remove() {},
        focus() {},
    };
    let _id = '';
    Object.defineProperty(el, 'id', {
        get: () => _id,
        set(v) { _id = v; if (v) registry.set(v, el); },
        configurable: true,
    });
    let _html = '';
    Object.defineProperty(el, 'innerHTML', {
        get: () => _html,
        set(v) { _html = v; if (v === '') el.children.length = 0; },
        configurable: true,
    });
    return el;
}

const documentStub = {
    createElement: (tag) => makeEl(tag),
    getElementById: (id) => registry.get(id) || null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    body: makeEl('body'),
};

const sandbox = {
    console, Event: EventCtor,
    document: documentStub,
    sessionStorage: {
        getItem: k => (sessionStorageMap.has(k) ? sessionStorageMap.get(k) : null),
        setItem: (k, v) => sessionStorageMap.set(k, String(v)),
        removeItem: k => sessionStorageMap.delete(k),
    },
    navigator: { clipboard: { writeText: async () => {} } },
    setTimeout: () => 0,
    clearTimeout() {},
    requestAnimationFrame: () => 0,
};
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ['js/config.js', 'js/utilities.js', 'js/data.js', 'js/formulas.js', 'js/damage-formulas.js', 'js/navigation.js', 'js/calculator.js']) {
    vm.runInContext(read(f), sandbox, { filename: f });
}

// â”€â”€ tests (data-driven: adapts to whatever ids data.js currently uses) â”€â”€â”€â”€â”€â”€â”€â”€
let failures = 0;
function check(name, fn) {
    try {
        fn();
        console.log(`PASS  ${name}`);
    } catch (err) {
        failures++;
        console.log(`FAIL  ${name}\n      ${err.message}`);
    }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
const formIds = () => vm.runInContext(`
    (() => {
        const c = document.getElementById('enemy-forms-container');
        return c.children.filter(x => String(x.id || '').startsWith('enemy-form-')).map(x => x.id);
    })()
`, sandbox);

// 0. Setup: extra input on the second enemy + phase-wide inputs, then render
//    and set a DISTINCT value on every input (enemy 1, enemy 2, phase-wide).
check('setup: render phase, set a distinct value on every input', () => {
    vm.runInContext(`
        (() => {
            const phase = findPhaseByEnemyId('1722001511');
            phase.enemies[1].inputs = [{ id: 'extra_x', label: 'EX', type: 'number', min: 0, max: 50, default: 0 }];
            phase.globalInputs = [
                { id: 'turn_count', label: 'Current turn', type: 'number', min: 1, max: 6, default: 1 },
                { id: 'hp_condition', label: 'HP?', type: 'checkbox', default: false },
            ];
            const c = document.createElement('div');
            c.id = 'enemy-forms-container';
            document.body.appendChild(c);
            displayEnemiesForPhase(c, phase, 1);
        })()
    `, sandbox);

    // enumerate the ACTUAL rendered inputs (data-driven)
    const ids = JSON.parse(vm.runInContext(`
        (() => JSON.stringify({
            e1: (findEnemyById('1722001511').inputs || []).map(i => ({ id: i.id, type: i.type })),
            e2: (findEnemyById('1722001512').inputs || []).map(i => ({ id: i.id, type: i.type })),
            ph: (findPhaseByEnemyId('1722001511').globalInputs || []).map(i => ({ id: i.id, type: i.type })),
        }))()
    `, sandbox));
    global.__e1 = ids.e1; global.__e2 = ids.e2; global.__ph = ids.ph;

    const setVal = (id, type, v) => {
        const el = registry.get(id);
        assert(!!el, `element ${id} not rendered`);
        if (type === 'checkbox') el.checked = v; else el.value = v;
    };
    ids.e1.forEach((inp, i) => setVal(`1722001511_${inp.id}`, inp.type, inp.type === 'checkbox' ? i % 2 === 0 : String(7 * (i + 1))));
    ids.e2.forEach((inp, i) => setVal(`1722001512_${inp.id}`, inp.type, '33'));
    ids.ph.forEach((inp) => setVal(`172200151_${inp.id}`, inp.type, inp.type === 'checkbox' ? true : '3'));
    // stash the expected values for later assertions
    global.__expected = {};
    ids.e1.forEach((inp, i) => { global.__expected[`1722001511_${inp.id}`] = inp.type === 'checkbox' ? i % 2 === 0 : String(7 * (i + 1)); });
    ids.e2.forEach(inp => { global.__expected[`1722001512_${inp.id}`] = '33'; });
    ids.ph.forEach(inp => { global.__expected[`172200151_${inp.id}`] = inp.type === 'checkbox' ? true : '3'; });
});

const assertValues = (msg) => {
    Object.keys(global.__expected).forEach(id => {
        const el = registry.get(id);
        assert(!!el, `${msg}: element ${id} missing`);
        const exp = global.__expected[id];
        const got = el.type === 'checkbox' ? el.checked : el.value;
        assert(String(got) === String(exp), `${msg}: ${id} expected ${exp}, got ${got}`);
    });
};

const val = (id) => {
    const el = registry.get(id);
    return el ? (el.type === 'checkbox' ? el.checked : el.value) : undefined;
};
// 1. Defeat enemy 1 (has inputs) â€” everyone's values persist
check('defeat âœ•: remaining enemies + phase-wide inputs keep their values', () => {
    vm.runInContext(`
        (() => {
            const form = document.getElementById('enemy-form-1722001511');
            form.querySelector('.enemy-defeat-btn').dispatchEvent(new Event('click'));
        })()
    `, sandbox);
    const ids = formIds();
    assert(!ids.includes('enemy-form-1722001511'), 'defeated form should be gone');
    global.__e2.forEach(inp => assert(ids.includes(`enemy-form-1722001512`), 'remaining form missing'));
    assertValues('after defeat');
    const flag = vm.runInContext(
        `collectEnemyInputValues(findEnemyById('1722001512')).defeated_1722001511`, sandbox);
    assert(flag === true, `defeated flag should be queryable, got ${flag}`);
});

// 2. Resurrect â€” the DEFEATED enemy's typed values come back
check('resurrect â†º: defeated enemy restores its typed values', () => {
    vm.runInContext(`
        (() => {
            const container = document.getElementById('enemy-forms-container');
            const chip = container.querySelector('.defeated-chip');
            chip.children.find(c => c.className === 'defeated-resurrect-btn')
                .dispatchEvent(new Event('click'));
        })()
    `, sandbox);
    const ids = formIds();
    assert(ids.includes('enemy-form-1722001511') && ids.includes('enemy-form-1722001512'),
        `both forms should be back, got ${JSON.stringify(ids)}`);
    assertValues('after resurrect');
    const vals = JSON.parse(vm.runInContext(
        `JSON.stringify(collectEnemyInputValues(findEnemyById('1722001511'),
            document.getElementById('enemy-form-1722001511')))`, sandbox));
    global.__e1.forEach((inp) => {
        const exp = global.__expected[`1722001511_${inp.id}`];
        const got = vals[inp.id];
        const expNorm = inp.type === 'checkbox' ? exp === true : Number(exp);
        assert(got === expNorm, `formula input ${inp.id} expected ${expNorm}, got ${got}`);
    });
});


// 3. The OTHER enemy: defeat -> resurrect keeps ITS typed values too
check('defeat/resurrect of the second enemy preserves its input', () => {
    registry.get('1722001512_extra_x').value = '44';
    global.__expected['1722001512_extra_x'] = '44';
    vm.runInContext(`
        (() => {
            const form = document.getElementById('enemy-form-1722001512');
            form.querySelector('.enemy-defeat-btn').dispatchEvent(new Event('click'));
        })()
    `, sandbox);
    assert(!formIds().includes('enemy-form-1722001512'), 'second form should be gone');
    assertValues('after defeating enemy 2');
    vm.runInContext(`
        (() => {
            const container = document.getElementById('enemy-forms-container');
            const chip = container.querySelector('.defeated-chip');
            chip.children.find(c => c.className === 'defeated-resurrect-btn')
                .dispatchEvent(new Event('click'));
        })()
    `, sandbox);
    assert(formIds().includes('enemy-form-1722001512'), 'second form should be back');
    assert(val('1722001512_extra_x') === '44', `extra_x should survive its own defeat, got ` + val('1722001512_extra_x'));
    assertValues('after resurrecting enemy 2');
});

// 4. Checkbox change listener syncs collected values (visual + recalc)
check('checkbox change event syncs collected values', () => {
    const hp = registry.get('172200151_hp_condition');
    hp.checked = false;
    hp.dispatchEvent(new Event('change'));
    assert(hp.checked === false, 'hp_condition should be false after change');
    const collected = vm.runInContext(
        `collectEnemyInputValues(findEnemyById('1722001511'))`, sandbox);
    assert(collected.hp_condition === false, `collected hp_condition should be false, got ` + collected.hp_condition);
});

console.log(failures === 0 ? '\nALL PERSISTENCE TESTS PASSED' : `\n` + failures + ' TEST(S) FAILED');
process.exit(failures === 0 ? 0 : 1);
