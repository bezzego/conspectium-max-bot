function addWordBreaksImproved() {
    
    const textElements = document.querySelectorAll('.item-content');
    
    textElements.forEach((element, index) => {
        const originalText = element.textContent;
        
        const textWithBreaks = originalText.replace(/([а-яёa-z]{5,})/gi, function(match) {
            return addSmartHyphens(match);
        });
        
        element.innerHTML = textWithBreaks;
    });
}

function addSmartHyphens(word) {
    if (word.length < 5) return word;
    
    const vowels = 'аеёиоуыэюяaeiouy';
    const consonants = 'бвгджзйклмнпрстфхцчшщbcdfghjklmnpqrstvwxz';
    
    let result = '';
    let currentPosition = 0;
    
    while (currentPosition < word.length) {
        const remainingLength = word.length - currentPosition;
        
        if (remainingLength < 5) {
            result += word.substring(currentPosition);
            break;
        }
        
        let breakPosition = Math.min(
            Math.max(3, Math.floor(word.length / 2)), 
            7
        );
        
        let foundGoodBreak = false;
        
        for (let offset = 0; offset <= 2; offset++) {
            const testPosition = Math.min(currentPosition + breakPosition + offset, word.length - 2);
            
            if (testPosition >= word.length - 1) continue;
            
            const currentChar = word[testPosition].toLowerCase();
            const nextChar = word[testPosition + 1].toLowerCase();
            
            if (vowels.includes(currentChar) || consonants.includes(nextChar)) {
                breakPosition = testPosition - currentPosition;
                foundGoodBreak = true;
                break;
            }
        }
        
        if (!foundGoodBreak) {
            breakPosition = Math.min(5, remainingLength - 2);
        }
        
        if (currentPosition > 0) {
            result += '&shy;';
        }
        
        result += word.substring(currentPosition, currentPosition + breakPosition);
        currentPosition += breakPosition;
    }
    
    return result;
}

function addSimpleWordBreaksUniversal() {
    
    const textElements = document.querySelectorAll('.item-content .question-text');
    
    textElements.forEach((element, index) => {
        const originalText = element.textContent;
        
        const textWithBreaks = originalText.replace(/([а-яёa-z0-9]{5,})/gi, function(match) {
            if (match.length < 5) return match;
            
            let result = '';
            const chunkSize = match.length <= 8 ? 4 : 5; 
            
            for (let i = 0; i < match.length; i += chunkSize) {
                if (i > 0) result += '&shy;';
                const currentChunkSize = Math.min(
                    chunkSize + Math.floor(Math.random() * 2), 
                    match.length - i
                );
                result += match.substring(i, i + currentChunkSize);
            }
            
            return result;
        });
        
        element.innerHTML = textWithBreaks;
    });
}

function addAggressiveWordBreaks() {
    
    const textElements = document.querySelectorAll('.item-content');
    
    textElements.forEach(element => {
        const originalText = element.textContent;
        
        const words = originalText.split(/(\s+)/);
        const processedWords = words.map(word => {
            if (word.length >= 5 && /[а-яёa-z]/i.test(word)) {
                let result = '';
                let pos = 0;
                
                while (pos < word.length) {
                    const remaining = word.length - pos;
                    
                    if (remaining <= 6) {
                        result += word.substring(pos);
                        break;
                    } else {
                        const chunkSize = Math.min(4 + Math.floor(Math.random() * 2), remaining - 2);
                        if (pos > 0) result += '&shy;';
                        result += word.substring(pos, pos + chunkSize);
                        pos += chunkSize;
                    }
                }
                
                return result;
            }
            
            return word;
        });
        
        element.innerHTML = processedWords.join('');
    });
}

function checkLongWordsUniversal() {
    const textElements = document.querySelectorAll('.item-content');
    let hasLongWords = false;
    
    textElements.forEach(element => {
        const words = element.textContent.split(/\s+/);
        const longWords = words.filter(word => word.length >= 5);
        
        if (longWords.length > 0) {
            hasLongWords = true;
        }
    });
    
    return hasLongWords;
}

document.addEventListener('DOMContentLoaded', function() {
    
    setTimeout(() => {
        
        if (checkLongWordsUniversal()) {
            
            addWordBreaksImproved();
            
            setTimeout(() => {
                const stillLongWords = checkLongWordsUniversal();
                if (stillLongWords) {
                    addAggressiveWordBreaks();
                }
            }, 100);
        } else {
        }
    }, 100);
});

const breakStyles = `
.item-content {
    word-wrap: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
    -webkit-hyphens: auto;
    -moz-hyphens: auto;
    -ms-hyphens: auto;
}

/* Принудительные переносы для старых браузеров */
@supports not (hyphens: auto) {
    .item-content {
        word-break: break-word;
    }
}
`;

const breakStyleSheet = document.createElement('style');
breakStyleSheet.textContent = breakStyles;
document.head.appendChild(breakStyleSheet);