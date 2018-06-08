var wallet = {
    wiToNas: function(num) {
        //nas转化为wi
        num = new BigNumber(num);
        num = num.dividedBy(1e18).toString();
        return num;
    },
    nasToWi: function(num) {
        //wi转化为nas
        var num = new BigNumber(num);
        num = num.times(1e18).toString();
        return num;
    },
    getAccountState: function(from_, callback) {
        var from = from_ || from;
        //查看钱包状态        
        api.getAccountState({
            address: from
        }).then(function(res) {
            $("#address").html(from);
            $("#balance").html(wallet.wiToNas(res.balance));
            if (callback) { callback(res) }
        }, function(err) {
            var message = err.message || "获取钱包信息失败";
            layer.alert(message);
        });
    },
    getresources: function(options, callback) {
        //获取资源（options默认传方法名和参数即可，value默认为0）
        var option = {
            from: from || from_request,
            to: to,
            value: 0, //默认为0
            nonce: nonce,
            gasPrice: gasPrice,
            gasLimit: gasLimit,
            contract: {
                function: "",
                args: ""
            }
        }
        option = $.extend(option, options);
        console.log(option.from)
        api.call(option).then(function(res) {
            callback && callback(res);

        });
    },
    sendRowTracition: function(config, callback, errcallback) {
        var to_ = config.to || to;
        var value = config.value || 0;
        console.log(value)
        var callFunction = config.callFunction || "";
        var callArgs = config.callArgs || "[]";
        var options = config.options || {
            listener: function(res) {
                var txhash = res.txhash;
                wallet.getTransactionReceipt(txhash, function(receipt) {
                    layer.msg("交易成功！");
                });
            }
        };
        nebPay.call(to_, value, callFunction, callArgs, options);
    },
    getTransactionReceipt: function(txhash, callback) {
        var intervalTrx = setInterval(function() {
            api.getTransactionReceipt({
                hash: txhash
            }).then(function(receipt) {
                console.log(receipt);
                if (receipt.status == 1) { //1--success;2--pending;
                    clearInterval(intervalTrx);
                    from = receipt.from;
                    wallet.getAccountState(from);
                    if (callback) {
                        callback(receipt);
                    }
                }
            }, function(err) {
                var message = err.message || "查询交易失败！";
                layer.alert(message);
            });
        }, 1500);
    }
}