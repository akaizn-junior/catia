function translateToCy(line) {
	let evaled = [];
	line = line.trim();
	const testActions = RegExp(/[(visit|type)]+\s[(\w://.)]+/g).exec(line);
	const testEvents = RegExp(/[(click|focus|double click|right click)]+\s\$\s[(\w-\s>#.)]+/g).exec(line);

	if (testActions) {
		evaled = testActions[0].split(/\s/);
	}

	if (testEvents) {
		evaled = testEvents[0].split(/\s\$\s/);
	}

	let value = evaled[1] || '';

	switch (true) {
	case evaled[0] === 'visit':
		return 'beforeAll(() => {'.concat('\n\tcy.visit', '("', value, '");\n});');
	case evaled[0] === 'type':
		return 'cy.type'.concat('("', value, '")', '.should(', '"have.value","', value, '");');
	case evaled[0] === 'click':
		return 'cy.get'.concat('("', value, '").click();');
	case evaled[0] === 'double click':
		return 'cy.get'.concat('("', value, '").click().click();');
	case evaled[0] === 'right click':
		return 'cy.get'.concat('("', value, '").rightClick();');
	case evaled[0] === 'focus':
		return 'cy.get'.concat('("', value, '").focus();');
	default: return '';
	}
}

console.log(translateToCy('visit https://google.com'));
console.log(translateToCy('click $ div.show-box > div.pretty-input'));
console.log(translateToCy('focus $ div.show-box > div.pretty-input'));
console.log(translateToCy('right click $ div.show-box > div.pretty-input'));
console.log(translateToCy('type banana'));
