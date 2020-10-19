import { templates, select, settings } from '../settings.js';
import { AmountWidget } from './AmountWidget.js';
import { DatePicker } from './DatePicker.js';
import { HourPicker } from './HourPicker.js';
import { utils } from '../utils.js';

export class Booking {
  constructor(bookingWidgetContainer) {
    const thisBooking = this;

    thisBooking.render(bookingWidgetContainer);
    thisBooking.initWidgets();
    thisBooking.getData();
    thisBooking.selectTable();
  }

  render(bookingWidgetContainer) {
    const thisBooking = this;

    const generatedHTML = templates.bookingWidget();

    thisBooking.dom = {};
    thisBooking.dom.wrapper = bookingWidgetContainer;
    thisBooking.dom.wrapper.innerHTML = generatedHTML;
    thisBooking.dom.peopleAmount = thisBooking.dom.wrapper.querySelector(
      select.booking.peopleAmount
    );
    thisBooking.dom.hoursAmount = thisBooking.dom.wrapper.querySelector(
      select.booking.hoursAmount
    );
    thisBooking.dom.datePicker = thisBooking.dom.wrapper.querySelector(
      select.widgets.datePicker.wrapper
    );
    thisBooking.dom.hourPicker = thisBooking.dom.wrapper.querySelector(
      select.widgets.hourPicker.wrapper
    );
    thisBooking.dom.tables = thisBooking.dom.wrapper.querySelectorAll(
      select.booking.tables
    );
    thisBooking.dom.inputAddress = thisBooking.dom.wrapper.querySelector(
      select.booking.address
    );
    thisBooking.dom.inputPhone = thisBooking.dom.wrapper.querySelector(
      select.booking.phone
    );
    thisBooking.dom.starters = thisBooking.dom.wrapper.querySelectorAll(
      select.booking.starters
    );
    thisBooking.dom.form = thisBooking.dom.wrapper.querySelector(
      '.booking-form'
    );
  }

  initWidgets() {
    const thisBooking = this;

    thisBooking.peopleAmount = new AmountWidget(thisBooking.dom.peopleAmount);
    thisBooking.hoursAmount = new AmountWidget(thisBooking.dom.hoursAmount);
    thisBooking.datePicker = new DatePicker(thisBooking.dom.datePicker);
    thisBooking.hourPicker = new HourPicker(thisBooking.dom.hourPicker);

    thisBooking.dom.wrapper.addEventListener('updated', function () {
      thisBooking.updateDOM();
    });

    thisBooking.dom.form.addEventListener('submit', function () {
      event.preventDefault();
      thisBooking.sendBooking();
    });
  }

  getData() {
    const thisBooking = this;

    const startEndDates = {};
    startEndDates[settings.db.dateStartParamKey] = utils.dateToStr(
      thisBooking.datePicker.minDate
    );
    startEndDates[settings.db.dateEndParamKey] = utils.dateToStr(
      thisBooking.datePicker.maxDate
    );

    const endDate = {};
    endDate[settings.db.dateEndParamKey] =
      startEndDates[settings.db.dateEndParamKey];

    const params = {
      booking: utils.queryParams(startEndDates),
      eventsCurrent:
        settings.db.notRepeatParam + '&' + utils.queryParams(startEndDates),
      eventsRepeat: settings.db.repeatParam + '&' + utils.queryParams(endDate),
    };

    console.log('getData params', params);

    const urls = {
      booking:
        settings.db.url + '/' + settings.db.booking + '?' + params.booking,
      eventsCurrent:
        settings.db.url + '/' + settings.db.event + '?' + params.eventsCurrent,
      eventsRepeat:
        settings.db.url + '/' + settings.db.event + '?' + params.eventsRepeat,
    };

    console.log('getData urls', urls);

    Promise.all([
      fetch(urls.booking),
      fetch(urls.eventsCurrent),
      fetch(urls.eventsRepeat),
    ])
      .then(function ([
        bookingsResponse,
        eventsCurrentResponse,
        eventsRepeatResponse,
      ]) {
        return Promise.all([
          bookingsResponse.json(),
          eventsCurrentResponse.json(),
          eventsRepeatResponse.json(),
        ]);
      })
      .then(function ([bookings, eventsCurrent, eventsRepeat]) {
        console.log(bookings);
        console.log(eventsCurrent);
        console.log(eventsRepeat);
        thisBooking.parseData(bookings, eventsCurrent, eventsRepeat);
      });
  }

  parseData(bookings, eventsCurrent, eventsRepeat) {
    const thisBooking = this;

    thisBooking.booked = {};

    console.log('eventsCurrent:', eventsCurrent);

    for (let event of eventsCurrent) {
      console.log('event', event);

      thisBooking.makeBooked(
        event.date,
        event.hour,
        event.duration,
        event.table
      );
    }

    for (let item of bookings) {
      console.log('bookings item', item);

      thisBooking.makeBooked(item.date, item.hour, item.duration, item.table);
    }

    for (let repEvent of eventsRepeat) {
      console.log('repeating event', repEvent);

      if (repEvent.repeat == 'daily') {
        const eventDateParse = new Date(repEvent.date);
        const maxDate = utils.addDays(repEvent.date, 14);

        for (
          let loopDate = eventDateParse;
          loopDate <= maxDate;
          loopDate = utils.addDays(loopDate, 1)
        ) {
          thisBooking.makeBooked(
            utils.dateToStr(loopDate),
            repEvent.hour,
            repEvent.duration,
            repEvent.table
          );
        }
      }
    }

    thisBooking.updateDOM();
  }

  makeBooked(date, hour, duration, table) {
    const thisBooking = this;

    if (typeof thisBooking.booked[date] == 'undefined') {
      thisBooking.booked[date] = {};
    }

    const startHour = utils.hourToNumber(hour);

    for (let hourBlock = startHour; hourBlock < startHour + duration; hourBlock += 0.5) {

      if (typeof thisBooking.booked[date][hourBlock] == 'undefined') {
        thisBooking.booked[date][hourBlock] = [];
      }

      for (let singleTable of table) {
        thisBooking.booked[date][hourBlock].push(singleTable);
      }
    }
    //console.log('thisBooking.booked', thisBooking.booked);
  }

  updateDOM() {
    const thisBooking = this;
    console.log(thisBooking.booked);

    thisBooking.date = thisBooking.datePicker.value;
    thisBooking.hour = utils.hourToNumber(thisBooking.hourPicker.value);

    let allAvailable = false;

    if (
      typeof thisBooking.booked[thisBooking.date] == 'undefined' ||
      typeof thisBooking.booked[thisBooking.date][thisBooking.hour] ==
        'undefined'
    ) {
      allAvailable = true;
    }

    for (let table of thisBooking.dom.tables) {
      const tableNumber = table.getAttribute(settings.booking.tableIdAttribute);
      const tableId = parseInt(tableNumber);

      if (
        !allAvailable &&
        thisBooking.booked[thisBooking.date][thisBooking.hour].includes(tableId)
      ) {
        table.classList.add('booked');
        table.classList.remove('selected');
      } else {
        table.classList.remove('booked', 'selected');
      }  
    }
  }

  selectTable() {
    const thisBooking = this;

    for (let table of thisBooking.dom.tables) {
      if (!table.classList.contains('booked')) {
        table.addEventListener('click', function () {
          table.classList.toggle('selected');
          thisBooking.blockOverbooking(table);
          console.log('table selected', table.classList.contains('selected'));
        });
      } else {
        table.classList.remove('selected');
      }
    }
  }

  blockOverbooking(table) {
    const thisBooking = this;

    const maxDuration = 24 - utils.hourToNumber(thisBooking.hourPicker.value);     
    const bookingButton = document.querySelector('#booking-button');
    const thisHour = utils.hourToNumber(thisBooking.hourPicker.value);
    console.log('maxDuration:', maxDuration);

    if (thisBooking.hoursAmount.value > maxDuration) {
      bookingButton.disabled = true;
      alert('Your booking duration is too long - the opening hours are 12pm-12am. Please set other duration.');
    }
  
    const tableNumber = table.getAttribute(settings.booking.tableIdAttribute);
    const tableId = parseInt(tableNumber);

    for (let hourBlock = thisHour; hourBlock < thisHour + thisBooking.hoursAmount.value; hourBlock += 0.5) {

      if (thisBooking.booked[thisBooking.date][hourBlock].includes(tableId)) {
        bookingButton.disabled = true;
        alert('This table is already booked within this time. Please set other duration.');
      }
    }
  }

  sendBooking() {
    const thisBooking = this;

    const url = settings.db.url + '/' + settings.db.booking;

    const payload = {
      date: thisBooking.date,
      hour: thisBooking.hourPicker.value,
      table: [],
      ppl: thisBooking.peopleAmount.value,
      duration: thisBooking.hoursAmount.value,
      starters: [],
      address: thisBooking.dom.inputAddress.value,
      phone: thisBooking.dom.inputPhone.value,
    };

    for (let starter of thisBooking.dom.starters) {
      if (starter.checked == true) {
        payload.starters.push(starter.value);
      }
    }

    for (let table of thisBooking.dom.tables) {

      const tableNumber = table.getAttribute(settings.booking.tableIdAttribute);
      const tableId = parseInt(tableNumber);

      if (table.classList.contains('selected')) {
        payload.table.push(tableId);
        table.classList.replace('selected', 'booked');
      }
    }

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    };

    fetch(url, options)
      .then(function (response) {
        return response.json();
      })
      .then(function (parsedResponse) {
        console.log('parsedResponse', parsedResponse);
      });
  }
}