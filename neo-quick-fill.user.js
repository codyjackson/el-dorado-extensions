// ==UserScript==
// @name         Neo Quick Fill
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Quick Fill Neo from Cognito Forms
// @author       You
// @match        https://us.idexxneo.com/clients/view/*
// @match        https://us.idexxneo.com/patients/view/*
// @icon         https://d1u164t7yxgyoz.cloudfront.net/assets/core/ac32f036d8ed3ae5e30427ee05a3fa946bc40b80/public/ico/favicon.png
// @grant        none
// ==/UserScript==

const testData = ``;

(function() {
    'use strict';

    let acceptingForm = false;
    const quickFillId = 'quick-fill-button';
    const YES_NO = {
        true: 'Yes',
        false: 'No',
    };

    function capitalizeFirstLetter(str) {
        return str.toLowerCase().charAt(0).toUpperCase() + str.slice(1);
    }

    function capitalizeFirstLetterOfEachWord(str) {
        return str.toLowerCase().split(' ').map(capitalizeFirstLetter).join(' ');
    }

    function fillValue(selector, value, upperCasing = true, trimValue = true) {
        if (typeof value === 'undefined' || value === null) {
            return;
        }

        const element = $(selector);
        if (element.length === 0) {
            console.info(`Couldn't find the element using the selector ${selector}`);
        }

        const modify = upperCasing ? capitalizeFirstLetterOfEachWord : s => s.toLowerCase();
        const trim = trimValue ? (s) => s.trim() : (s) => s;
        element.val(modify(trim(value))).change();
    }

    function createValueFiller(selector) {
        return (value) => fillValue(selector, value);
    }


    function fillPrimaryName(cognitoData) {
        let value = cognitoData['Name'];
        if (cognitoData['Name1'] && !includedInTheOther(value, cognitoData['Name1'])) {
            value = cognitoData['Name1'];
        }
        const [firstName, lastName] = value.split(' ');
        fillValue('#txtFirstname', firstName);
        fillValue('#txtLastname', lastName);
    }

    function fillPrimaryPhoneNumbers(cognitoData) {
        const primaryType = cognitoData['Primary Phone Type'];
        const primaryNumber = cognitoData['Primary Phone'];
        const secondaryType = cognitoData['Secondary Phone Type'];
        const secondaryNumber = cognitoData['Secondary Phone'];

        const lookup = {
            'Cell': 'input[name=telephone3]',
            'Home': 'input[name=telephone1]',
            'Work': 'input[name=telephone2]'
        };

        fillValue(lookup[primaryType], primaryNumber);
        console.log('aaaa', secondaryType)
        if (!secondaryType || !secondaryNumber) {
            return;
        }


        if (secondaryType !== primaryType) {
            fillValue(lookup[secondaryType], secondaryNumber);
        } else {
            fillValue('input[name=secondary_telephone1]', secondaryNumber);
        }
    }

    function fillPrimaryEmail(cognitoData) {
        const email = cognitoData['Email'];
        const subscribedToPromotionalEmail = cognitoData['Receive news and specials via email newsletter?'] === 'Yes';

        if (!email) {
            return;
        }

        const declinesEmail = cognitoData[`May we email regarding your pet's care and reminders for services due?`] !== 'Yes';
        fillValue('input[name=EXTRAFIELD_Declines_Email_]', YES_NO[declinesEmail]);

        if (declinesEmail) {
            appendToNotes(email);
            fillValue('#client_email', '');
        } else {
            fillValue('#client_email', email, false);
        }
        
        $('#unsubscribed').prop('checked', !subscribedToPromotionalEmail);
    }

    function fillPrimaryAddress(cognitoData) {
        let value = cognitoData['Address']?.trim() || '';
        if (!value) {
            return;
        }

        value = value.replaceAll(',,', ',')

        const zipRegex = /[0-9]{5}$/g;
        const zipMatch = value.match(zipRegex);
        value = value.slice(0, -5).trim();
        fillValue('input[name=postcode]', zipMatch[0]);

        const stateRegex = /[a-zA-Z]+$/g;
        const stateMatch = value.match(stateRegex);
        value = value.replace(stateRegex, '').trim();
        fillValue('input[name=state]', stateMatch[0]);

        const cityRegex = /[a-zA-Z ]+,$/g;
        const cityMatch = value.match(cityRegex);
        value = value.replace(cityMatch, '').trim();
        fillValue('input[name=city]', cityMatch[0]?.replaceAll(',', ''));

        // Street
        const trailingCommaRegex = /,$/g;
        value = value.replace(trailingCommaRegex, '').trim();
        fillValue('textarea[name=address]', value);
    }

    function fillPrimarySeasonal(cognitoData) {
        fillValue('input[name=EXTRAFIELD_FSEA1]', cognitoData['Are you a seasonal resident?']);
    }

    function fillPrimaryPhotos(cognitoData) {
        fillValue('input[name=EXTRAFIELD_Photos_for_marketing_]', cognitoData['May we use photos of your pet(s) for education or marketing?']);
    }

    function fillPrimaryClient(cognitoData) {
        fillPrimaryName(cognitoData);
        fillPrimaryEmail(cognitoData);
        fillPrimaryPhoneNumbers(cognitoData);
        fillPrimaryAddress(cognitoData);
        fillPrimarySeasonal(cognitoData);
        fillPrimaryPhotos(cognitoData);
    }

    function fillSecondaryContact(cognitoData) {
        const value = cognitoData['Name2'];
        const primaryType = cognitoData['Primary Phone Type'];
        const secondaryType = cognitoData['Secondary Phone Type'];
        const [firstName, lastName] = value.split(' ');

        fillValue('input[name=secondary_first_name]', firstName);
        fillValue('input[name=secondary_last_name]', lastName);

        if (primaryType === secondaryType) {
            fillValue('input[name=secondary_telephone1]', cognitoData['Secondary Phone']);
        }
    }

    function appendToNotes(line) {
        if (!line) {
            return;
        }

        const textArea = $('textarea[name=notes]');
        let notes = textArea.val();
        if (notes) {
            notes += '\n';
        }

        notes += line;
        textArea.val(notes);
    }

    function includedInTheOther(str1, str2) {
        if (!str1 || !str2) {
            return;
        }

        const a = (str1 || '').trim();
        const b = (str2 || '').trim();

        return a.includes(b) || b.includes(a);
    }

    function getUniqueNameCount(cognitoData) {
        const totalCount = 1;
        for (let i = 1; i < 3; ++i) {
            const name = cognitoData[`Name${i}`];
            if (name && !includedInTheOther(name, cognitoData[`Name`])) {
                ++totalCount;
            }
        }

        return totalCount;
    }

    function fillAlternateContact(cognitoData) {
        const alternateContactName = cognitoData[`Alternate Contact`];
        const alternateContactPhone = cognitoData[`Alternate Contact Phone`];
        const alternateContactRelationship = cognitoData[`Alternate Contact Relationship to Client`];

        if (!alternateContactName) {
            return;
        }

        if (getUniqueNameCount(cognitoData) < 2) {
            const lookup = {
                'Spouse': '1',
                'Significant Other': '2',
                'Relative': '3',
                'Friend': '4',
                'Other': '5'
            };
           const [firstName, lastName] = alternateContactName.split(' ');
           fillValue('input[name=secondary_first_name]', firstName);
           fillValue('input[name=secondary_last_name]', lastName);
           fillValue('input[name=secondary_telephone1]', alternateContactPhone);

           const type = cognitoData['Alternate Contact Relationship to Client'];
           if (type) {
               fillValue('select[name=secondary_type]', lookup[type] || '0', true, false);
           }
        } else {
           const formattedRelationship = alternateContactRelationship ? ` (${alternateContactRelationship})` : '';
           appendToNotes(`${alternateContactName}${formattedRelationship}: ${alternateContactPhone}`);
        }
    }

    function fillPrimaryOkayToText(cognitoData) {
        fillValue('input[name=EXTRAFIELD_Okay_to_text__]', cognitoData['May we text brief messages to a cell number?']);
    }

    function fillPrimaryMarketing(cognitoData) {
        const input = cognitoData['How did you learn about us?'];
        if (!input) {
            return;
        }

        const lookup = {
            'Employee': ' Employee',
            'Location / Drive by': ' Drive By /Signage',
            'Google': ' Google',
            'Yelp': ' Yelp'
        };
        fillValue('select[name=marketing]', lookup[input], true, false);
    }

    function fillPrimaryReferredBy(cognitoData) {
        fillValue('input[name=EXTRAFIELD_Referral_Client_]', cognitoData['Referred by']);
    }

    function fillPrimaryClientInfo(cognitoData) {
        fillPrimaryClient(cognitoData);
        fillSecondaryContact(cognitoData);
        fillPrimaryOkayToText(cognitoData);
        fillPrimaryMarketing(cognitoData);
        fillPrimaryReferredBy(cognitoData);
    }

    function fillClientInfo(cognitoData) {
        fillPrimaryClientInfo(cognitoData);

        fillAlternateContact(cognitoData);
    }

    function pkey(key, index) {
        const suffix = index === 0 ? '' : index;
        return `${key}${suffix}`;
    }

    function fillPatientName(cognitoData, index) {
        const name = cognitoData[pkey('Pet name', index)];
        fillValue('input[name=patient_name]', name);
    }

    function fillPatientColor(cognitoData, index) {
        const name = cognitoData[pkey('Color', index)];
        fillValue('input[name=colour]', name);
    }

    function insertFormData(data, selector) {
        const target = $(selector);
        target.after(`<div style="height: 30px; display: flex; align-items: center; color: #b94a48; font-weight: bold; width: 100%;">Cognito: ${data}</div>`);
    }

    function showPatientAge(cognitoData, index) {
        const age = cognitoData[pkey('Date of birth / Approximate age', index)];

        insertFormData(age, '#date_of_birth_boxes');
    }

    function showPatientBreed(cognitoData, index) {
        const breed = cognitoData[pkey('Breed', index)] || `&ltempty&gt`;

        insertFormData(breed, '#breedId+.select2');
    }

    function showPatientSpecies(cognitoData, index) {
       const species = cognitoData[pkey('Species', index)];

        insertFormData(species, '#speciesId+.select2');
    }

    function fillPatientSex(cognitoData, index) {
        const gender = cognitoData[pkey('Sex', index)];
        const fixed = cognitoData[pkey('Spayed/Neutered', index)] === 'Yes';

        const lookup = {
           'Male-false': '2',
           'Male-true': '1',
           'Female-false': '5',
           'Female-true': '4'
        }
        const sex = lookup[`${gender}-${fixed}`];

        fillValue('select[name=gender_id]', sex, true, false);
    }

    function fillPatientInfo(cognitoData, index) {
        fillPatientName(cognitoData, index);
        fillPatientColor(cognitoData, index);
        showPatientAge(cognitoData, index);
        showPatientBreed(cognitoData, index);
        showPatientSpecies(cognitoData, index);
        fillPatientSex(cognitoData, index);
    }

    function areMultiplePatients(cognitoData) {
        return true;
    }

    function getPatientNames(cognitoData) {
        return [cognitoData['Pet name'], cognitoData['Pet name1'], cognitoData['Pet name2']]
            .filter(n => n);
    }

    function addMultiplePatientButtons(cognitoData) {
        const quickFillButton = $(`#${quickFillId}`);
        quickFillButton.text('Select The Patient');

        getPatientNames(cognitoData).forEach((name, index) => {
            const button = $(`<span class="btn patient-btn" style="margin-top: -7px">${name}</span>`);

            button.on('click', () => {
                fillPatientInfo(cognitoData, index);
            });

            button.insertAfter(quickFillButton);
        });
    }

    function preparePatientInfo(cognitoData) {
        if (areMultiplePatients(cognitoData)) {
            addMultiplePatientButtons(cognitoData);
        } else {
            fillPatientInfo(cognitoData, 0);
        }
    }


    let enteredCognitoData = {};
    document.addEventListener('paste', function(e) {
        if (!acceptingForm) {
             return;
        };
        e.preventDefault();

        const pastedText = testData || e.clipboardData.getData('text/html');

        const content = $('<div></div>');
        content.html(pastedText);

        if (window.location.pathname === '/clients/view/12') {
            appendToNotes(content.html());
            return;
        }

        const rows = content.find('tr').toArray();
        const columnsInRow = rows.map(row => {
            return $(row).find('td').toArray();
        });

        const firstRowBeforeDataIndex = columnsInRow.findLastIndex((row) => row.length !== 2);
        const dataRows = columnsInRow.slice(firstRowBeforeDataIndex + 1, -1);
        const rawData = dataRows.map((row) => row.map(col => $(col).text().trim()));
        enteredCognitoData = {};
        const counts = {};

        rawData.forEach(([key, value]) => {
            let currentKey = key.replace(/\s+/g, ' ');
            if (typeof counts[currentKey] === 'number') {
                counts[currentKey]++;
                currentKey = `${currentKey}${counts[currentKey]}`;
            } else {
                counts[currentKey] = 0;
            }

            enteredCognitoData[currentKey] = value.replace(/\s+/g, ' ');
        });

        console.log('form data', enteredCognitoData);

        if (window.location.pathname.includes('/patients/view')) {
            preparePatientInfo(enteredCognitoData);
        }

        if (window.location.pathname.includes('/clients/view')) {
            fillClientInfo(enteredCognitoData);
        }
    });

    $(document).ready(() => {
        const user = $('.navbar .navbar-inner .nav .dropdown-toggle').text();
        if (!user.includes('Jenna Roller')) {
            return;
        }

        const quickFillLocation = $('.inner-suite>.col1>h1>.pull-right');
        const quickFillText = 'Fast Fill';
        const quickFillFocusText = 'Paste Cognito Form';
        const quickFillButton = $(`<span id="${quickFillId}" class="btn" style="margin-top: -7px;">${quickFillText}</span>`);
        const focusClass = 'btn-success';

        quickFillButton.on('click', () => {
            if (acceptingForm) {
                return;
            }
            quickFillButton.addClass(focusClass);
            quickFillButton.text(quickFillFocusText);
            acceptingForm = true;
        })

        $(document).on('click', (event) => {
           if (event.target.id !== quickFillId) {
               quickFillButton.removeClass(focusClass);
               quickFillButton.text(quickFillText);
               acceptingForm = false;
               $('.patient-btn').remove();
           }
        });

        const buttonGroup = $(`<span class="btn-group" role="group" style="margin-right: 10px;"></span>`);
        buttonGroup.prepend(quickFillButton);
        quickFillLocation.prepend(buttonGroup);
    });
    // Your code here...
})();
