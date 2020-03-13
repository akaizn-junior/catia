var x = [
	'cool a',
	'type h',
	'type e',
	'type l',
	'click o',
	'type l',
	'type o',
	'look u'
];

let TOKEN_SPACE = ' ';

function mashStringsByKeyword(strings, keyword) {
	// reads an array of strings
	// mashes consecutive strings with the same keyword
	// into one string only
	const li = strings.length - 1;
	// gotta be any value that may not occur from user input
	// or it will be split
	const commaHash = 'comma';
	const useKeyword = 'input';

	if (strings.length && keyword) {
		return strings.reduce((p, c, i) => {
			let res = p + commaHash + c;
			if (c.includes(keyword)) {
				let j = c.replace(/\s/g, '').split(keyword);
				return (p + j[1] || '').trim();
			}
			return i === 0 ? p : i === li ? res : res + commaHash;
		}, '')
			.split(commaHash)
			.map(c => (c.length && !c.includes(TOKEN_SPACE) ? useKeyword + TOKEN_SPACE + c : c));
	}

	return strings;
}

console.log(mashStringsByKeyword(x, 'type'));
