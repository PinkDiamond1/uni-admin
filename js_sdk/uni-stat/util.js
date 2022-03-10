/**
 *  以下为 uni-stat 的工具方法
 */

// 获取指定日期当天或 n 天前零点的时间戳，丢弃时分秒
function getTimeOfSomeDayAgo(days = 0, date = Date.now()) {
	const d = new Date(date)
	const oneDayTime = 24 * 60 * 60 * 1000
	let ymd = [d.getFullYear(), d.getMonth() + 1, d.getDate()].join('-')
	ymd = ymd + ' 00:00:00'
	const someDaysAgoTime = new Date(ymd).getTime() - oneDayTime * days
	return someDaysAgoTime
}

// 将查询条件拼接为字符串
function stringifyQuery(query, customQuery) {
	const queryArr = []
	if (customQuery && typeof customQuery === 'string') {
		queryArr.push(customQuery)
	}
	const keys = Object.keys(query)
	keys.forEach(key => {
		if (key === 'time_range') return
		let val = query[key]
		if (val) {
			if (typeof val === 'string') {
				val = `"${val}"`
			}
			if (key === 'start_time') {
				const time = query.start_time
				if (Array.isArray(time) && time.length === 2) {
					queryArr.push(`start_time >= ${time[0]} && start_time <= ${time[1]}`)
				} else {
					queryArr.push(`start_time == ${time}`)
				}
			} else {
				queryArr.push(`${key} == ${val}`)
			}
		}
	})
	const queryStr = queryArr.join(' && ')

	return queryStr || {}
}

function stringifyField(mapping, goal, prop) {
	if (goal) {
		mapping = mapping.filter(f => f.field === goal)
	}
	if (prop) {
		mapping = mapping.filter(f => f.field && f.hasOwnProperty(prop))
	}
	const fields = mapping.map(f => `${f.field} as ${ 'temp_' + f.field}`)
		.join()
	return fields
}

function stringifyGroupField(mapping, goal, prop) {
	if (goal) {
		mapping = mapping.filter(f => f.field === goal)
	}
	if (prop) {
		mapping = mapping.filter(f => f.field && f.hasOwnProperty(prop))
	}
	const groupField = mapping.map(f => `${f.stat ? f.stat : 'sum' }(${'temp_' + f.field}) as ${f.field}`)
		.join()

	return groupField
}

function division(dividend, divisor) {
	if (divisor) {
		return dividend / divisor
	} else {
		return 0
	}
}

function format(num, type = ',') {
	if (!type) return num
	if (typeof num !== 'number') return num
	if (type === '%') {
		// 注意浮点数精度
		// num = Number.parseFloat(num).toPrecision(4)
		num = (num * 100).toFixed(2)
		return num + type
	} else if (type === '%%') {
		return num.toFixed(2) + '%'
	} else if (type === '-') {
		return formatDate(num, 'day')
	} else if (type === ':') {
		num = Math.ceil(num)
		let h, m, s
		h = m = s = 0
		const wunH = 60 * 60,
			wunM = 60 // 单位秒, wun 通 one
		if (num >= wunH) {
			h = Math.floor(num / wunH)
			const remainder = num % wunH
			if (remainder >= wunM) {
				m = Math.floor(remainder / wunM)
				s = remainder % wunM
			} else {
				s = remainder
			}
		} else if (wunH >= num && num >= wunM) {
			m = Math.floor(num / wunM)
			s = num % wunM
		} else {
			s = num
		}
		const hms = [h, m, s].map(i => i < 10 ? '0' + i : i)
		return hms.join(type)
	} else if (type === ',') {
		return num.toLocaleString()
	} else {
		return num
	}
}

function formatDate(date, type) {
	console.log('-------date:', date)
	let d = new Date(date)
	if (type === 'hour') {
		let h = d.getHours()
		h = h < 10 ? '0' + h : h
		return `${h}:00 ~ ${h}:59`
	} else if (type === 'week') {
		const first = d.getDate() - d.getDay(); // First day is the day of the month - the day of the week
		const last = first + 6; // last day is the first day + 6
		let firstday = new Date(d.setDate(first));
		firstday = parseDateTime(firstday)
		let lastday = new Date(d.setDate(last));
		lastday = parseDateTime(lastday)
		return `${firstday} ~ ${lastday}`
	} else if (type === 'month') {
		let firstday = new Date(d.getFullYear(), d.getMonth(), 1);
		firstday = parseDateTime(firstday)
		let lastday = new Date(d.getFullYear(), d.getMonth() + 1, 0);
		lastday = parseDateTime(lastday)
		return `${firstday} ~ ${lastday}`
	} else {
		return parseDateTime(d)
	}
}

function parseDateTime(datetime, type) {
	let d = datetime
	console.log('--------ddd', d)
	if (typeof d !== 'object') {
		d = new Date(d)
	}
	const year = d.getFullYear()
	const month = d.getMonth() + 1
	const day = d.getDate()
	const hour = d.getHours()
	const minute = d.getMinutes()
	const second = d.getSeconds()
	const date = year + '-' + lessTen(month) + '-' + lessTen(day)
	const time = lessTen(hour) + ':' + lessTen(minute) + ':' + lessTen(second)
	if (type === "dateTime") {
		return date + ' ' + time
	}
	return date
}

function lessTen(item) {
	return item < 10 ? '0' + item : item
}

function mapfields(map, data = {}, goal, prefix = '', prop = 'value') {
	const goals = [],
		argsGoal = goal
	map = JSON.parse(JSON.stringify(map))
	const origin = JSON.parse(JSON.stringify(data))
	for (const mapper of map) {
		let {
			field,
			computed,
			formatter
		} = mapper
		// if (!field) return // stat index
		goal = argsGoal || mapper
		const hasValue = goal.hasOwnProperty(prop)
		const preField = prefix + field
		if (data) {
			const value = data[preField]
			if (value) {
				const val = format(value, formatter)
				if (hasValue) {
					if (goal.field === field) {
						goal[prop] = val
					}
				} else {
					goal[field] = val
				}
			} else {
				if (computed) {
					const computedFields = computed.split('/')
					let [dividend, divisor] = computedFields
					dividend = Number(origin[prefix + dividend])
					divisor = Number(origin[prefix + divisor])
					if (dividend && divisor) {
						const val = format(division(dividend, divisor), formatter)
						// const val = division(dividend, divisor)
						if (hasValue) {
							goal[prop] = val
						} else {
							goal[field] = val
						}
					}
				}
			}
		}
		if (hasValue) {
			goals.push(goal)
		}
	}
	return goals
}


export {
	stringifyQuery,
	stringifyField,
	stringifyGroupField,
	mapfields,
	getTimeOfSomeDayAgo,
	division,
	format,
	formatDate,
	parseDateTime
}
