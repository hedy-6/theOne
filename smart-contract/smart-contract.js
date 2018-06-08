'use strict';

var Item = function(text) {
    if (text) {
        var o = JSON.parse(text);
        this.itemId = o.itemId; //项目id
        this.name = o.name;
        this.member = new Number(o.member); //成员数量
        this.price = new BigNumber(o.price); //押注单价
    } else {
        this.itemId = "";
        this.name = "";
        this.rate = new Number(0);
        this.price = new BigNumber(0);
    }
};

Item.prototype = {
    toString: function() {
        return JSON.stringify(this);
    }
};

var Bet = function(text) {
    if (text) {
        var o = JSON.parse(text);
        this.itemId = o.itemId; //项目id
        this.address = o.address;
    } else {
        this.itemId = "";
        this.address = "";
    }
};

Bet.prototype = {
    toString: function() {
        return JSON.stringify(this);
    }
};


var TheOneContract = function() {
    LocalContractStorage.defineProperty(this, "itemSize"); //size
    LocalContractStorage.defineMapProperty(this, "itemIndex"); //Number=>itemId
    LocalContractStorage.defineMapProperty(this, "itemResults"); //itemId=>adress
    LocalContractStorage.defineMapProperty(this, "items", { //存储项目
        parse: function(text) {
            return new Item(text);
        },
        stringify: function(o) {
            return o.toString();
        }
    });
    LocalContractStorage.defineMapProperty(this, "bets");
}


TheOneContract.prototype = {
    init: function() {
        //设置管理员身份
        var from = Blockchain.transaction.from;
        LocalContractStorage.set("admin", from);
        this.itemSize = 0;
    },

    viewAdmin: function() {
        return LocalContractStorage.get("admin");
    },
    //下注，项目编号和压注大小, itemBets = [ { itemId, value }  ]
    bet: function(itemId) {
        itemId = new Number(itemId);
        var item = this.items.get(itemId);
        if (!item) throw new Error("项目不存在！");
        if (!Blockchain.transaction.value.eq(item.price)) throw new Error("下注金额必须等于项目要求金额！");
        var bet = new Bet();
        bet.itemId = itemId;
        bet.address = Blockchain.transaction.from;
        var bets = JSON.parse(this.bets.get(itemId));
        if (!bets) bets = {};
        if (bets.hasOwnProperty(bet.address)) throw new Error("您已经参加该项目！");

        bets[bet.address] = bet;
        this.bets.put(itemId, JSON.stringify(bets));
        //如果人数满了，则开奖
        console.log("TheOneContract member " + item.member + ", bets number " + Object.keys(bets).length + ", bets: " + JSON.stringify(bets));
        if (item.member <= Object.keys(bets).length) {
            var timestamp = new Date().getTime();
            Math.random.seed('' + timestamp);
            var index = parseInt(Math.random() * Object.keys(bets).length);
            var c = 0;
            var address = '';
            for (var a in bets) {
                if (index == c) {
                    address = a;
                    break;
                }
                c++;
            }
            this.itemResults.put(itemId, address); //将中奖人写入结果中
            console.log("TheOneContract the one is " + address + ", index is " + index);
            //转账
            var amount = item.price.times(item.member).times('0.99');
            var result = Blockchain.transfer(address, amount);
            if (!result) {
                throw new Error("transfer failed.");
            }
            Event.Trigger("Lottery", {
                Transfer: {
                    from: Blockchain.transaction.to,
                    to: address,
                    value: amount.toString()
                }
            });
        }

        return 1;
    },

    //创建项目
    createItem: function(name, member, price) {
        var timestamp = new Date().getTime();
        Math.random.seed('' + timestamp);
        var itemId = timestamp + parseInt(Math.random() * 100);
        var member = new Number(member);
        var price = new BigNumber(price).times('1000000000000000000');
        if (member < 1 || price <= 0 || member > 100) {
            throw new Error("参数不合法, 1 <= member <= 100, price > 0");
        }
        //console.log("itemId: " + itemId + ", rate: " + rate + ", price" + price)
        var item = new Item();
        item.itemId = itemId;
        item.member = member;
        item.price = price;
        item.name = name;
        this.items.put(item.itemId, item);
        //添加索引
        var index = this.itemSize;
        this.itemIndex.set(index, itemId);
        this.itemSize += 1;
        console.log("TheOneContract " + this.items.get(item.itemId));
        return this.items.get(item.itemId);
    },

    //查看项目状态
    viewItems: function() {
        var list = {};
        for (var i = 0; i < this.itemSize; i++) {
            var itemId = this.itemIndex.get(i);
            var item = this.items.get(itemId);
            var itemInfo = JSON.parse(item.toString());
            itemInfo['isin'] = 0;
            itemInfo['price'] = new BigNumber(itemInfo['price']).dividedBy(1e18).toString();
            var bets = this.bets.get(itemId);
            if (bets) {
                bets = JSON.parse(bets.toString());
                itemInfo['takepart'] = Object.keys(bets).length;
                if (bets.hasOwnProperty(Blockchain.transaction.from)) {
                    itemInfo['isin'] = 1;
                }
            } else {
                itemInfo['takepart'] = 0;
            }
            if (item.member <= itemInfo['takepart']) {
                //说明这个项目已经有结果了
                itemInfo['result'] = this.itemResults.get(itemId);
            } else {
                itemInfo['result'] = '';
            }
            list[itemId] = itemInfo;
            console.log("TheOneContract itemInfo " + JSON.stringify(itemInfo));
        }
        return list;
    },

    test: function() {
        console.log("TheOneContract " + JSON.stringify(this.itemSize));
        return 1;
    },

    //如果发生合约迭代，则管理员需要取出余额，转出
    takeout: function(value) {
        var from = Blockchain.transaction.from;
        var to = LocalContractStorage.get("admin");
        var bk_height = new BigNumber(Blockchain.block.height);
        var amount = new BigNumber(value);

        if (from != to) {
            throw new Error("普通用户无权限取出余额");
        }

        var result = Blockchain.transfer(from, amount);
        if (!result) {
            throw new Error("transfer failed.");
        }
        Event.Trigger("Lottery", {
            Transfer: {
                from: Blockchain.transaction.to,
                to: from,
                value: amount.toString()
            }
        });
    }
};
module.exports = TheOneContract;