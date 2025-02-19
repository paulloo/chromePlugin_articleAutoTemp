import Handlebars from "handlebars/runtime"

// 预编译的模板
export const defaultTemplate = Handlebars.template({
  "1": function(container: any, depth0: any, helpers: any, partials: any, data: any) {
    const helper = helpers.title || (depth0 && depth0.title)
    return container.escapeExpression(((typeof helper === "function" ? helper.call(depth0, { "name": "title", "hash": {}, "data": data }) : helper)))
  },
  "3": function(container: any, depth0: any, helpers: any, partials: any, data: any) {
    const helper = helpers.content || (depth0 && depth0.content)
    return container.escapeExpression(((typeof helper === "function" ? helper.call(depth0, { "name": "content", "hash": {}, "data": data }) : helper)))
  },
  "compiler": [8, ">= 4.3.0"],
  "main": function(container: any, depth0: any, helpers: any, partials: any, data: any) {
    let stack1
    return "<div class=\"article\">\n  <h1>" +
      ((stack1 = helpers.boldFirstSentence.call(depth0, (depth0 != null ? depth0.guide : depth0), { "name": "boldFirstSentence", "hash": {}, "data": data })) != null ? stack1 : "") +
      "</h1>\n  <div class=\"profile\">" +
      container.escapeExpression((helpers.boldFirstSentence || (depth0 && depth0.boldFirstSentence) || container.hooks.helperMissing).call(depth0, (depth0 != null ? depth0.profile : depth0), { "name": "boldFirstSentence", "hash": {}, "data": data })) +
      "</div>\n  <div class=\"steps\">\n" +
      ((stack1 = helpers.each.call(depth0, (depth0 != null ? depth0.steps : depth0), {
        "name": "each", "hash": {}, "fn": container.program(1, data, 0), "inverse": container.noop, "data": data
      })) != null ? stack1 : "") +
      "  </div>\n</div>"
  },
  "useData": true
}) 