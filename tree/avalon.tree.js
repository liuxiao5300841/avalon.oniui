/**
  *  @description tree组件，借鉴ztree实现的avalon版本树组件，尽量接近ztree的数据结构
  *
  */
define(["avalon", "text!./avalon.tree.html", "text!./avalon.tree.leaf.html", "text!./avalon.tree.parent.html",  "text!./avalon.tree.nodes.html", "../live/avalon.live", "css!./avalon.tree.css", "css!../chameleon/oniui-common.css"], function(avalon, template, leafTemplate, parentTemplate, nodesTemplate) {

    var optionKeyToFixMix = {view: 1, callback: 1},
        eventList = ["click", "dblClick", "collapse", "expand", "select", "contextmenu", "mousedown", "mouseup"],
        ExtentionMethods = [],
        undefine = void 0,
        tplDict = {},
        disabelSelectArr = []
    //  tool functions
    function g(id) {
        return document.getElementById(id)
    }

    function tplFormate(tpl) {
        return tpl.replace(/\{\{MS_[^\}]+\}\}/g, function(mt) {
            var k = mt.substr(mt.indexOf("_") + 1).replace("}}", "").toLowerCase()
            return tplDict[k] || ""
        })
    }

    //  树状数据的标准化，mvvm的痛
    function dataFormator(arr, parentLeaf, dataFormated, func, vm) {
        avalon.each(arr, function(index, item) {
            if(!dataFormated) {
                itemFormator(item, parentLeaf, vm)
            } else if(item){
                item.$parentLeaf = parentLeaf
                func && func(item)
            }
            if(item && item.children && item.children.length) dataFormator(item.children, item, dataFormated, undefine, vm)
        })
    }
    function formate(item, dict) {
        avalon.each(dict, function(key, value) {
            if(key === "hasOwnProperty") return
            item[key] = item[value] || ""
        })
    }
    /**
      * 格式化数据，补全字段
      */
    function itemFormator(item, parentLeaf, vm) {
        if(!item) return
        item.level = parentLeaf ? parentLeaf.level + 1 : 0
        item.isParent = itemIsParent(item)
        formate(item, vm.data.key)
        // 不要可监听
        item.$parentLeaf = parentLeaf || ""
        if(item.isParent) {
            item.open = !!item.open
        } else {
            item.open = false
        }   
        // 诶，子节点也可能被编辑成父节点...         
        item.children = item.children || []
        return item
    }
    function itemIsParent(item) {
        return !!item.isParent || !!item.open || !!(item.children&&item.children.length)
    }
    /**  将简单的数组结构数据转换成树状结构
      *  注如果是一个没有子节点的父节点必须加isParent = true，open属性只有父节点有必要有
      *  input array like [
      *      {id: 1, pId: 0, name: xxx, open: boolean, others},// parent node
      *      {id: 11, pId: 1, name: xxx, others}// 子节点
      *  ]
      */
    function simpleDataToTreeData(arr, vm) {
        if(!arr.length) return []
        var dict = vm.data.simpleData, idKey = dict.idKey, pIdKey = dict.pIdKey
        var prev, tree = [], stack = [], tar, now
        for(var i = 0, len = arr.length; i < len; i++) {
            now = itemFormator(arr[i], undefine, vm)
            // 前一个节点是直属父节点
            if(prev && prev[idKey] === now[pIdKey]) {
                // 标记父节点
                prev.isParent = true 
                itemFormator(prev, undefine, vm)
                // 防止重复压入堆栈
                if(!tar || tar !== prev) {
                    stack.push(prev)
                    tar = prev
                }
                tar.children.push(now)
            // 当前节点是一个父节点或者没有出现过父节点或者出现的父节点非自己的父节点
            } else if(now.isParent || !tar || tar[idKey] !== now[pIdKey]) {
                // 出栈知道找到自己的父节点或者栈空
                while(tar && (now[pIdKey] !== tar[idKey])) {
                    stack.pop()
                    tar = stack[stack.length - 1]
                }
                (tar && tar.children || tree).push(now)
                // 明确已知自己是一个父节点，压入栈中
                if(now.isParent) {
                    stack.push(now)
                    tar = now
                }
            // 非父节点以及未确认是否父节点
            } else {
                (tar && tar.children || tree).push(now)
            }
            now.level = stack.length
            now[pIdKey] = now[pIdKey] || 0
            prev = now
        }
        return tree
    }

    function arrayIndex(arr, filter) {
        for(var i = 0, len = arr.length; i < len; i++) {
            if(filter(arr[i])) return i
        }
        return -1
    }

    function upperFirstLetter(str) {
        return str.replace(/^[a-z]{1}/g, function(mat) {
            return mat.toUpperCase()
        })
    }

    var widget = avalon.ui.tree = function(element, data, vmodels) {
        var options = data.treeOptions, cache = {}// 缓存节点
        template = tplFormate(template)
        parentTemplate = tplFormate(parentTemplate)
        leafTemplate = tplFormate(leafTemplate)
        nodesTemplate = tplFormate(nodesTemplate)
        //方便用户对原始模板进行修改,提高定制性
        options.template = options.getTemplate(template, options)
        options.parentTemplate = options.getTemplate(parentTemplate, options, "parent").replace(/\n/g, "").replace(/>[\s]+</g, "><")
        options.leafTemplate = options.getTemplate(leafTemplate, options, "leaf").replace(/\n/g, "").replace(/>[\s]+</g, "><")
        options.nodesTemplate = nodesTemplate
        var newOpt = {}
        avalon.mix(newOpt, options)
        avalon.each(optionKeyToFixMix, function(key) {
            avalon.mix(true, newOpt[key], avalon.mix(true, {}, widget.defaults[key], newOpt[key]))
        })
        if(newOpt.data.simpleData.enable) {
            newOpt.children = simpleDataToTreeData(newOpt.children, newOpt)
        } else {
            dataFormator(newOpt.children, undefine, undefine, undefine, newOpt)
        }
        var vmodel = avalon.define(data.treeId, function(vm) {
            // mix插件配置
            avalon.each(ExtentionMethods, function(i, func) {
                func && func(vm, vmodels)
            })
            avalon.mix(vm, newOpt)
            vm.widgetElement = element
            vm.widgetElement.innerHTML = vm.template
            vm.$skipArray = ["widgetElement", "template", "callback"]
            vm._select = []

            var inited
            vm.$init = function() {
                if(inited) return
                inited = true
                dataFormator(vm.children, undefine, "构建父子节点衔接关系", function(leaf) {
                    cache[leaf.$id] = leaf
                }, vm)
                avalon.scan(element, [vmodel].concat(vmodels))
                if(!vm.view.txtSelectedEnable && navigator.userAgent.match(/msie\s+[5-8]/gi)) {
                    disabelSelectArr.push(vm.widgetElement)
                }
                if(typeof options.onInit === "function" ) {
                    //vmodels是不包括vmodel的 
                    options.onInit.call(element, vmodel, options, vmodels)
                }
            }
            vm.$remove = function() {
                element.innerHTML = element.textContent = ""
                cache = null
                vm._select = null
            }
            // 展开相关
            // 展开
            vm.hasClassOpen = function(leaf, noline) {
                if(vm.optionToBoolen(vm.view.showLine, leaf)) {
                    return leaf.isParent && leaf.open && noline != 'noline'
                } else {
                    return leaf.isParent && leaf.open && noline
                }
            }
            vm.toggleOpenStatue = function(event, leaf) {
                var leaf = leaf || event.leaf
                if(!leaf) return
                leaf.open ? vm.excute("collapse", event, leaf, "collapse") : vm.excute("expand", event, leaf, "expand")
            }
            //@method expand(leaf, all) 展开leaf节点的子节点，all表示是否迭代所有子孙节点
            vm.expand = function(arg, all, openOrClose) {
                var leaf = arg.leaf
                if(!leaf) {
                    leaf = vm
                } else {
                    if(!leaf.isParent) return
                    leaf.open = !openOrClose
                }
                var children = leaf.children, leafDom = g(leaf.$id)
                // 节点未渲染，或不可见，向上溯源处理
                if(!leafDom || !leafDom.scrollHeight) vm.cVisitor(leaf, function(node) {
                    node.open = true
                })
                // 互斥
                if(vm.view.singlePath && !openOrClose) {
                    var children = leaf.$parentLeaf ? leaf.$parentLeaf.children : vm.children
                    avalon.each(children, function(i, item){
                        if(item != leaf && item.open) vm.excute("collapse", arg.e, item, "collapse") 
                    })
                }
                if(all) avalon.each(children, function(i, item) {vm.expand(item, "all", openOrClose)})
            }
            vm.expandAll = function(openOrClose) {
                openOrClose ? vm.expand(undefine, "all") : vm.collapse(undefine, "all")
            }
            //@method collapse(leaf, all) 折叠leaf节点的子节点，all表示是否迭代所有子孙节点
            vm.collapse = function(leaf, all, event) {
                vm.expand(leaf, all, "close", event)
            }

            vm.hasChildren = function(leaf, visible) {
                // 有有效子节点
                var renderStatus = leaf.children && leaf.children.length && vm.hasClassOpen(leaf, "ignoreNoline")
                if(visible) {
                    return renderStatus
                } else {
                    return renderStatus || g("c" + leaf.$id)
                }
            }

            vm.loadLeafTemplate = function(leaf) {
                if(leaf.isParent) return vm.parentTemplate
                return vm.leafTemplate
            }

            vm.loadNodes = function(levelGT0) {
                if(!levelGT0) return vm.nodesTemplate
                return vm.nodesTemplate.replace(/leaf=\"children\"/g, "leaf=\"leaf.children\"")
            }

            vm.timeStamp = function() {
                return Date.now()
            }
            // 目测这个是相当费性能的。。。
            vm.moveNode = function(targetLeaf, leaf, moveType, isSilent) {
                var parLeaf = leaf.$parentLeaf || vm,
                    indexA = arrayIndex(parLeaf.children, function(item) {
                        return item == leaf || item == leaf.$model
                    }),
                    level = leaf.level
                if(indexA < 0) return
                if(!targetLeaf) targetLeaf = vm
                if(targetLeaf == vm) moveType = "inner"
                // 移除
                parLeaf.children.splice(indexA, 1)
                if(moveType == "inner") {
                    // 注入
                    if(!targetLeaf.isParent && targetLeaf != vm) targetLeaf.isParent = true
                    leaf.$parentLeaf = targetLeaf == vm ? false : targetLeaf
                    leaf.level = leaf.$parentLeaf ? leaf.$parentLeaf.level + 1 : 0
                    targetLeaf.children.push(leaf)
                } else {
                    moveType = moveType === "prev" ? "prev" : "next"
                    var parLeafB = targetLeaf.$parentLeaf,
                        tarArray = parLeafB ? parLeafB.children : vm.children,
                        indexB = arrayIndex(tarArray, function(item) {
                            return item == targetLeaf || item == targetLeaf.$model
                        })
                    // 挂载到新的父节点下
                    leaf.$parentLeaf = parLeafB
                    leaf.level = targetLeaf.level
                    tarArray.splice(indexB, 0, leaf)
                }
                if(leaf.$parentLeaf) vm.expand(leaf.$parentLeaf)
                // 层级变化了
                if(level != leaf.level) vm.visitor(leaf, function(node) {
                    if(node != leaf) node.level = node.$parentLeaf.level + 1
                })
            }

            // 节点遍历
            // 中序遍历，向下
            vm.visitor = function(startLeaf, func, endFunc, res, options) {
                var startLeaf = startLeaf || vm,
                    res = res || []
                if(startLeaf != vm) {
                    var data = func(startLeaf, options)
                    data && res.push(data)
                    if(endFunc && endFunc(res, startLeaf)) return res
                }
                if(startLeaf.isParent) {
                    for(var i = 0, children = startLeaf.children, len = children.length; i < len; i++) {
                        if(endFunc && endFunc(res, children[i])) break
                        vm.visitor(children[i], func, endFunc, res, options)
                    }
                }
                return res
            }
            // 向上溯源
            vm.cVisitor = function(startLeaf, func, endFunc, res, options) {
                var res = res || []
                if(startLeaf) {
                    var data = func(startLeaf, options)
                    data && res.push(data)
                    // 结束溯源
                    if(endFunc && endFunc(res, startLeaf)) return res
                    // 继续向上
                    if(startLeaf.$parentLeaf) vm.cVisitor(startLeaf.$parentLeaf, func, endFunc, res, options)
                }
                return res
            }

            // 获取节点
            vm.getNodeByTId = function(id) {
                return cache[id]
            }

            vm.getNodeIndex = function(leaf) {
                var c = leaf.$parentLeaf ? leaf.$parentLeaf.children : vm.children
                for(var i = 0, len = c.length; i < len; i++) {
                    if(c[i] === leaf) return i
                }
                return -1
            }

            vm.getNodes = function() {
                return vm.children
            }

            vm.getNodesByFilter = function(fitler, isSingle, startLeaf, options) {
                return vm.visitor(startLeaf, filter, isSingle ? function(data, node) {
                    return data.length > 1
                } : false, [], options)
            }

            vm.getNodeByParam = function(key, value, startLeaf) {
                return vm.getNodesByParam(key, value, startLeaf, function(data, node) {
                    return data.length > 1
                })
            }

            vm.getNodesByParam = function(key, value, startLeaf, endFunc) {
                return vm.visitor(startLeaf, function(leaf) {
                    return leaf[key] === value
                }, endFunc, [])
            }

            vm.getNodesByParamFuzzy = function(key, value, startLeaf) {
                return vm.visitor(startLeaf, function(leaf) {
                    return (leaf[key] + "").match(new RegExp(value, "g"))
                }, false, [])
            }

            vm.getPreNode = function(leaf, next) {
                var allMates = leaf.$parentLeaf ? leaf.$parentLeaf.children : vm.children,
                    index = vm.getNodeIndex(leaf)
                return allMates[next ? index + 1 : index-1]
            }

            vm.getNextNode = function(leaf) {
                return vm.getPreNode(leaf, "next")
            }

            vm.getParentNode = function(leaf) {
                return leaf.$parentLeaf
            }

            vm.getSelectedNodes = function(startLeaf) {
                if(!startLeaf) return vm._select
                var info = vm._getSelectIDs(startLeaf),
                    ids = info.dict,
                    res = [],
                    _s = vm._select
                for(var i = 0, len = _s.length; i < len; i++) {
                    var k = _s[i].$id
                    if(ids[k]) res.push(_s[i])
                }
                return res
            }

            // cache管理
            vm.removeCacheById = function(id) {
                delete cache[id]
            }

            //选中相关，可能是一个性能瓶颈，之后可以作为优化的点
            vm.hasClassSelect = function(leaf) {
                for(var i = 0, len = vm._select.length; i < len; i++) {
                    if(vm._select[i].$id === leaf.$id) return i + 1
                }
                return 0
            }
            vm._getSelectIDs = function(leaf) {
                var total = 0, dict = {}
                if(leaf) {
                    vm.visitor(leaf, function(leaf){
                        // 是否被选中
                        if(avalon(g(leaf.$id).getElementsByTagName("a")[0]).hasClass("curSelectedNode")) {
                            dict[leaf.$id] = 1
                            total++
                        }
                    }, false)
                }
                return {
                    total: total,
                    dict: dict
                }
            }
            // 取消节点的选中状态
            vm.selectFun = function(event, all) {
                var leaf = leaf || event.leaf,
                    event = event.e
                if(!leaf.url) event.preventDefault()
                if(all) {
                    var _s = vm._select,
                        info = vm._getSelectIDs(leaf),
                        total = count = info.total,
                        dict = info.dict
                    // 删除优化
                    if(total > 1) _s.$unwatch()
                    for(var i = 0; i < _s.length; i++) {
                        var k = _s[i]
                        if(dict[k.$id]) {
                            _s.splice(i, 1)
                            i--
                            count--
                            if(count == 1 && total > 1) _s.$watch()
                        }
                    }
                    res = dict = null
                } else {
                    var id = leaf.$id, index = vm.hasClassSelect(leaf)
                    if(index) {
                        vm._select.splice(index - 1, 1)
                    } else {
                        if(vm.ctrlCMD(event, leaf)) {
                            vm._select.push(leaf)
                        } else {
                            vm._select = [leaf]
                        }
                    }
                }
            }
            vm.selectNode = function(leaf, appendOrReplace) {
                if(vm.view.selectedMulti === false) appendOrReplace = false
                if(appendOrReplace) vm._select.push(leaf)
                else vm._select = [leaf]
            }
            //@method freeSelect(event, leaf)取消leaf节点上所有处于选中状态的节点
            vm.freeSelect = function(event, leaf) {
                if(!leaf) {
                    // clear all
                    vm._select.clear()
                } else {
                    vm.selectFun(event, leaf, "all")
                }
            }

            vm.ctrlCMD = function(event, leaf) {
                return event.ctrlKey && vm.optionToBoolen(vm.view.selectedMulti, leaf, event)
            }

            vm.optionToBoolen = function() {
                var arg = arguments[0]
                if(!avalon.isFunction(arg)) return arg
                return arg.apply(vm, [].slice.call(arguments,1))
            }
            // 鼠标事件相关
            vm.liveContextmenu = function(event) {
                vm.$fire("e:contextmenu", {
                    e: event,
                    vmodel: vm,
                    vmodels: vmodels
                })
            }
            vm.liveClick = function(event) {
                vm.$fire("e:click", {
                    e: event,
                    vmodel: vm,
                    vmodels: vmodels
                })
            }
            // 事件分发中心
            vm.excute = function(cmd, event, leaf, action) {
                var evt = cmd, eventName = upperFirstLetter(cmd),
                    beforeFunc = vm.callback["before" + eventName],
                    onFunc = vm.callback["on" + eventName],
                    arg = {
                        e: event,
                        leaf: leaf,
                        vm: vm,
                        vmodels: vmodels,
                        preventDefault: function() {
                            this.cancel = true
                        }
                    }, ele = event ? event.srcElement || event.target : null
                // 执行前检测，返回
                vmodel.$fire("e:before" + eventName, arg)
                if(beforeFunc && beforeFunc.call(ele, arg) === false || arg.cancel) return
                if(action) {
                    if(!avalon.isFunction(action)) action = vm[action]
                    if(avalon.isFunction(action)) action.call(ele, arg)
                }
                vmodel.$fire("e:" + cmd, arg) 
                onFunc && onFunc.call(ele, arg)
            }
            vm.createLeaf = function(item, parentLeaf) {
                return itemFormator(item, parentLeaf, vm)
            }

            vm.cloneNode = function(leaf) {
                return avalon.mix({}, leaf.$model)
            }

            vm.exprAnd = function() {
                var len = arguments.length, step = 1, res = step, leaf = arguments[0]
                while(step < len) {
                    res = res && vm.optionToBoolen(arguments[step], leaf)
                    step++
                }
                return res
            }
        })
      
        return vmodel
    }
    function disabelSelect(event) {
        var src = event.srcElement
        for(var i = 0, len = disabelSelectArr.length; i < len; i++) {
            if(avalon.contains(disabelSelectArr[i], src) && src.type != "text") {
                event.preventDefault()
                return
            }
        }
    }
    avalon.bind(document.body, "selectstart", disabelSelect)
    avalon.bind(document.body, "drag", disabelSelect)
    //add args like this:
    //argName: defaultValue, \/\/@param description
    //methodName: code, \/\/@optMethod optMethodName(args) description 
    widget.defaults = {
        view: {//@param 视觉效果相关的配置
            showLine: true,//@param view.showLine是否显示连接线
            dblClickExpand: true,//@param view.dblClickExpand是否双击变化展开状态
            selectedMulti: true,//@param view.selectedMulti true / false 分别表示 支持 / 不支持 同时选中多个节点
            txtSelectedEnable: false,
            autoCancelSelected: false,
            singlePath: true,
            showIcon: true,//@param view.showIcon zTree 是否显示节点的图标
            showTitle: true,//@param view.showTitle 分别表示 显示 / 隐藏 提示信息
            nameShower: function(leaf) {
                return leaf.name
            }//@optMethod view.nameShower(leaf)节点显示内容过滤器，默认是显示leaf.name
        },
        data: {
            simpleData: {
                idKey: "id",
                pIdKey: "pId",
                enable: false
            },
            key: {
                checked: "checked",
                children: "children",
                name: "name",
                title: "",
                url: "url"
            }
        },
        callback: {//@param 回调相关的配置
            //@optMethod callback.onExpand(data) 节点展开回调
            //@optMethod callback.onCollapse(data) 节点收起回调
            //@optMethod callback.onSelect(data) 节点被选中回调
            //@optMethod callback.onClick(data) 节点被点击回调
            //@optMethod callback.onDblClick(data) 节点被双击回调
        },
        //@optMethod onInit(vmodel, options, vmodels) 完成初始化之后的回调,call as element's method
        onInit: avalon.noop,
        getTemplate: function(tmpl, opts, tplName) {
            return tmpl
        },//@optMethod getTemplate(tpl, opts, tplName) 定制修改模板接口
        $author: "skipper@123"
    }
    avalon.each(eventList, function(i, item) {
        if(item == "contextmenu") item = "RightClick"
        widget.defaults.callback["on" + upperFirstLetter(item)] = avalon.noop
        widget.defaults.callback["before" + upperFirstLetter(item)] = false
    })

    //@method avalon.ui.tree.AddExtention(fixNames, addingDefaults, addingMethodFunc, watchEvents)扩展tree
    avalon.ui.tree.AddExtention = function(fixNames, addingDefaults, addingMethodFunc, watchEvents, tplHooks) {
        if(fixNames) avalon.each(fixNames, function(i, item) {
            optionKeyToFixMix[item] = item
        })
        if(addingDefaults) avalon.mix(true, widget.defaults, addingDefaults)
        if(addingMethodFunc) ExtentionMethods.push(addingMethodFunc)
        if(watchEvents) eventList = eventList.concat(watchEvents)
        if(tplHooks) avalon.mix(tplDict, tplHooks)
    }
})