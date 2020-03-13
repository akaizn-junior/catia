/*!
 * Catia
 * Capture user actions in the browser
 * @license MIT - @author (c) 2020 Verdexdesign
 */

// Globals

const defaultIgnoreNodes = [
	'html',
	'body'
];

const events = {
	focus: 'focus',
	click: 'click',
	doubleClick: 'double click',
	hover: 'hoverover',
	rightClick: 'right click'
};

const actions = {
	type: 'type',
	wait: 'wait',
	press: 'press',
	scrollLeft: 'scroll left',
	scrollRight: 'scroll right',
	scrollDown: 'scroll down',
	scrollUp: 'scroll up',
	input: 'input',
	copy: 'copy',
	paste: 'paste',
	cut: 'cut',
	select: 'select',
	visit: 'visit'
};

const digits = [
	'abcdefghijklmnopqrstuvwxyz',
	'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
	'0123456789',
	'`~!@#$%^&*()_-=+\\|}{][":\';<,.>/?*-+^~´ªºÇç«»ã'
].join('');

const capturedActions = [];
let lastCapturedAction = '';
const TOKEN_SELECTOR = '$';
const TOKEN_SPACE = ' ';
let lastKnownScrollPositionY = 0;
let lastKnownScrollPositionX = 0;
let ticking = false;

// Helpers

function isObject(obj) {
	if (obj) {
		let type = Object.prototype.toString.call(obj);
		type = type.replace(/[\s[\]]/g, '').toLowerCase()
			.substring(0, 6);
		return type === 'object';
	}

	return false;
}

function isEditable(node) {
	const contentEditable = node.contentEditable === 'true';
	const name = getNodeName(node);
	const editables = ['input', 'textarea'];
	return editables.includes(name) || contentEditable;
}

// Interface

function captureScrollPosition(opts, scroolData) {
	const {
		currentPositionX,
		currentPositionY,
		maxY,
		maxX
	} = scroolData;

	const halfPointY = parseInt(maxY / 4, 10);
	const halfPointX = parseInt(maxX / 4, 10);

	if (currentPositionY < maxY && currentPositionY >= halfPointY) {
		logAction({ opts, captured: action('scrollDown') });
	}

	if (currentPositionY > 0 && currentPositionY < halfPointY) {
		logAction({ opts, captured: action('scrollUp') });
	}

	if (currentPositionX < maxX && currentPositionX >= halfPointX) {
		logAction({ opts, captured: action('scrollRight') });
	}

	if (currentPositionX > 0 && currentPositionX < halfPointX) {
		logAction({ opts, captured: action('scrollLeft') });
	}
}

function action(cmd) {
	const TOKEN_ACTION = events[cmd] || actions[cmd];
	const isEvent = Boolean(events[cmd]);

	return (
		isEvent && {
			token: cmd,
			cmd: TOKEN_ACTION,
			action: TOKEN_ACTION + TOKEN_SPACE + TOKEN_SELECTOR + TOKEN_SPACE
		}
		|| !isEvent && {
			token: cmd,
			cmd: TOKEN_ACTION,
			action: TOKEN_ACTION + TOKEN_SPACE
		}
	);
}

function getNodeAttributes(attributes) {
	const attrs = {};
	for (let attr of attributes) {
		attrs[attr.nodeName] = attr.nodeValue;
	}

	return attrs;
}

function getNodeName(node) {
	const name = node.nodeName || node.tagName || node.localName;
	return name.toLowerCase();
}

function getNodeData(node) {
	const {
		classList,
		attributes,
		parentNode,
		nextElementSibling,
		previousElementSibling,
		clientHeight,
		clientWidth,
		clientLeft,
		clientTop,
		offsetHeight,
		offsetWidth,
		offsetLeft,
		offsetTop,
		dataset,
	} = node;

	// get defined values
	const name = getNodeName(node);
	const parentNodeName = parentNode && getNodeName(parentNode) || '';
	const prevNodeName = previousElementSibling && getNodeName(previousElementSibling) || '';
	const nextNodeName = nextElementSibling && getNodeName(nextElementSibling) || '';
	const _attributes = attributes ? getNodeAttributes(attributes) : [];

	return {
		name,
		parentNodeName,
		nextNodeName,
		prevNodeName,
		classList: [...classList] || [],
		dataset: dataset || [],
		clientHeight,
		clientWidth,
		clientLeft,
		clientTop,
		offsetHeight,
		offsetWidth,
		offsetLeft,
		offsetTop,
		attributes: { ..._attributes }
	};
}

function buildSelectors(data) {
	const attributes = data.attributes;
	const attrs = Object.entries(attributes);
	let aDefinedAttr = null;

	// get the first non-empty attribute
	for (let i = 0; i < attrs.length; i++) {
		const key = attrs[i][0];
		const value = attrs[i][1];
		if (value.length) {
			aDefinedAttr = {
				[key]: value,
				specificSelector: `${data.parentNodeName} > ${data.name}[${key}="${value}"]`
			};
			break;
		}
	}

	return (
		attributes.id && {
			id: attributes.id,
			idSelector: `#${attributes.id}`,
			specificSelector: `${data.parentNodeName} > ${data.name}#${attributes.id}`
		}
		|| attributes.class && {
			class: `${data.name}.${attributes.class}`,
			classSelector: `.${attributes.class}`,
			specificSelector: `${data.parentNodeName} > ${data.name}.${attributes.class}`
		}
		|| aDefinedAttr && aDefinedAttr
		|| {
			name: data.name,
			specificSelector: `${data.parentNodeName} > ${data.name}`
		}
	);
}

function getClosestSelector(target, options) {
	const { ignoreNodes } = options;
	const nodeSelectors = buildSelectors(getNodeData(target));
	const selector = nodeSelectors.idSelector || nodeSelectors.classSelector || nodeSelectors.name;
	return !ignoreNodes.includes(selector)
		? nodeSelectors.specificSelector
		: null;
}

function typeEvent(ev, options) {
	const target = ev.target;
	const { captureSpacePress, typeDigits } = options;

	let value = ev.key || target.value || target.innerHTML || target.textContent;
	const isValidEditable = isEditable(target);
	value = captureSpacePress && value === ' ' ? ev.code : value;

	return (
		isValidEditable && typeDigits && digits.includes(value)
			? { action: action('type'), value }
			: { action: action('press'), value }
	);
}

function logAction(data, ...r) {
	const { opts, captured: o } = data;
	const rest = r?.join('') || '';
	let capturedAction = (o?.action || '') + rest;

	const event = new CustomEvent('catiacapture', {
		detail: {
			actions: capturedActions,
			lastAction: capturedAction
		}
	});

	// may capture multiple of these
	const ignoreForTheseTokens = ['type', 'press'];

	const canDispatch = lastCapturedAction !== capturedAction
	|| ignoreForTheseTokens.includes(o.token)
	|| opts.registerMultipleTimes;

	if (canDispatch) {
		capturedActions.push(capturedAction);
		window.dispatchEvent(event);
	}

	lastCapturedAction = capturedAction;
}

function capture(opts = {}) {
	// eslint-disable-next-line no-console
	console.info('Capturing actions with catia');
	const ignoreNodes = 'ignoreNodes' in opts && opts.ignoreNodes || defaultIgnoreNodes;

	return () => {
		let waitCount = 0;
		window.addEventListener('load', () => {
			logAction({ opts, captured: action('visit')}, location.href);
			// wait every second, considering dead time
			opts.showWait && setTimeout(() => {
				setInterval(() => {
					logAction({ opts, captured: action('wait') }, waitCount);
					waitCount++;
				}, 1000);
			}, opts.waitTimeout || 5000);
		}, false);

		window.addEventListener('mouseover', ev => {
			waitCount = 0;
			// get the closest selector to the element hovered
			const closestSelector = getClosestSelector(ev.target, { ignoreNodes });
			// check if the element actually exists by the selector
			const elem = closestSelector && document.querySelector(closestSelector);

			closestSelector
			&& opts.captureHover
			&& logAction({ opts, captured: action('hover') }, closestSelector);

			// add focus event on the element just hovered, for when is focused
			if (elem) {
				elem.addEventListener('focus', e => {
					const target = e.target;
					const isFocusable = Number(target.tabIndex) >= 0;

					if (isFocusable && opts.captureFocusOnClick) {
						logAction({ opts, captured: action('focus') }, closestSelector);
					}
				}, false);

				elem.addEventListener('input', e => {
					if (e.target.type === 'color') {
						logAction({ opts, captured: action('input') }, e.target.value);
					}
				}, false);
			}
		}, false);

		window.addEventListener('click', ev => {
			waitCount = 0;
			getClosestSelector(ev.target, { ignoreNodes })
			&& logAction({ opts, captured: action('click') }, getClosestSelector(ev.target, { ignoreNodes }));
		}, false);

		window.addEventListener('dblclick', ev => {
			waitCount = 0;
			getClosestSelector(ev.target, { ignoreNodes })
			&& logAction({ opts, captured: action('doubleClick') }, getClosestSelector(ev.target, { ignoreNodes }));
		}, false);

		window.addEventListener('keydown', ev => {
			waitCount = 0;

			if (ev.keyCode === 9) {
				getClosestSelector(ev.target, { ignoreNodes })
				&& logAction({ opts, captured: action('focus') }, getClosestSelector(ev.target, { ignoreNodes }));
			}

			if (ev.target.type !== 'password' || opts.allowPasswordInput) {
				let typeEvOpts = {
					captureSpacePress: opts.captureSpacePress,
					typeDigits: isEditable(ev.target)
				};

				const typed = typeEvent(ev, typeEvOpts);
				typed.value.length && logAction({ opts, captured: typed.action }, typed.value);
			}
		}, false);

		window.addEventListener('contextmenu', ev => {
			waitCount = 0;
			logAction({ opts, captured: action('rightClick') }, getClosestSelector(ev.target, { ignoreNodes }) || 'document');
		}, false);

		opts.captureScroll && window.addEventListener('scroll', () => {
			waitCount = 0;

			lastKnownScrollPositionY = window.scrollY;
			lastKnownScrollPositionX = window.scrollX;
			const maxY = window.scrollMaxY;
			const maxX = window.scrollMaxX;

			if (!ticking) {
				window.requestAnimationFrame(function() {
					captureScrollPosition(opts, {
						currentPositionX: lastKnownScrollPositionX,
						currentPositionY: lastKnownScrollPositionY,
						maxY,
						maxX
					});
					ticking = false;
				});
				ticking = true;
			}
		});

		window.addEventListener('selectstart', () => {
			waitCount = 0;
			logAction({ opts, captured: action('select') });
		}, false);

		window.addEventListener('select', () => {
			waitCount = 0;
			logAction({ opts, captured: action('select') });
		}, false);

		window.addEventListener('copy', () => {
			waitCount = 0;
			logAction({ opts, captured: action('copy') });
		}, false);

		window.addEventListener('paste', () => {
			waitCount = 0;
			logAction({ opts, captured: action('paste') });
		}, false);

		window.addEventListener('cut', () => {
			waitCount = 0;
			logAction({ opts, captured: action('cut') });
		}, false);
	};
}

/**
 * Capture user actions in the browser
 * @param {{
 * 		captureFocusOnClick?: boolean,
 *		captureSpacePress?: boolean,
 *		registerMultipleTimes?: boolean,
 *		captureScroll?: boolean,
 *		ignoreNodes?: Array,
 *		captureHover?: boolean,
 *		showWait?: boolean,
 *		allowPasswordInput?: boolean
 * }} options catia settings
 * @param {(actions) => {}} callback Run on every captured action
 * @return catia methods
 */
function catia(options = {}, callback = () => {}) {
	const opts = isObject(options) && options || {};

	window.addEventListener('catiacapture', e => {
		callback({...e.detail});
	}, false);

	return {
		/**
		 * Start capturing user events
		 */
		capture: capture(opts)
	};
}

// Export

window.catia = catia;
