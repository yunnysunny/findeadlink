/**
 * @copyright yunnysunny <yunnysunny@gmail.com>
 * @license MIT 
 * 
 * 真是不幸，自己的网站又中木马了，网站空间出现了一个木马文件夹，里面充斥着各种垃圾网页，
 * 而且短短时间内这些垃圾网页就被google收录了。这些做木马的人技术还真是强悍，我自己做的网页
 * 八辈子收录不了，他这木马网页短短两个星期的样子就被大面积收录。
 * 
 * 和之前处理百度死链的脚本工具的使用模式是一样的：
 * `phantomjs 脚本文件路径 搜索条件 要处理的分页数`
 * 然后会生成一个`error_links_google.txt`,里面存储的是访问网页过程中无法访问资源的链接，当然无法访问
 * 并不大表他就是木马网页，有可能是你正常的资源但是由于某种原因无法访问了。所以你还得手工筛选一下。
 * 
 * 得到这个`error_links_google.txt`之后就可以去https://www.google.com/webmasters/tools/removals?hl=zh-cn
 * 提交你的死链请求了。
 * 
 */
var fs = require('fs');
var webpage = require('webpage');
var system = require('system');


var keyword = 'site:whyun.com';
var searchUrl = 'https://www.google.com.hk/search?ie=UTF-8&q=';
var pageCount = 7;
if (system.args.length == 3) {
	keyword = system.args[1];	
	pageCount = parseInt(system.args[2]);
	pageCount = pageCount > 1 ? pageCount: 1;
}

console.log('try to search ' + keyword + ',the page count is ' + pageCount);
searchUrl += encodeURIComponent(keyword);
var num = pageCount;
var pageHistory = pageCount;
var totalLinks = [];
var linkLen = 0;
var hasNavigatedCount = 0;

var errorStream = fs.open("error_links_google.txt","w");
var okStream = fs.open('ok_links_google.txt','w');

for (var i=0;i<num;i++) {
	var pageOffset = i*10;
	var pageUrl = searchUrl + '&start=' + pageOffset;
	
	searchTimer(pageUrl,i);
}

function searchTimer(url,index) {
	setTimeout(function() {
		searchOnePage(url,index);
	},1000*index);
}



function searchOnePage(pageUrl,index) {
	var page = webpage.create();
	
	page.onConsoleMessage = function(msg) {
		console.log(msg);
	};

	page.onCallback = function(link) {
	    
	    if (link instanceof Array) {
	    	console.log('get some links:'+link.join(','));
	    	totalLinks = totalLinks.concat(link);
	    } else {
	    	console.warn('link is empty!');
	    }
	    pageCount--;
	    console.log('current page:'+(pageHistory - pageCount));
	    if (pageCount == 0) {
	    	console.log('to navigate real url now.');
	    	getRealUrl();
	    }
	};
	page.onUrlChanged = function(targetUrl) {
	    console.log('New URL: ' + targetUrl);
	};
	page.onLoadFinished = function(status) {
		if (status !== 'success') {
	        console.error('Unable to access network:'+pageUrl);
	        pageCount--;
	        if (pageCount == 1) {
	        	getRealUrl();
		    }
	        return;
	    }
		setTimeout(function(){
			page.evaluate(function() {
				
				var urls = [];

				try {
					var ts = document.getElementsByTagName('cite');
					console.log("link area length:"+ts.length);
					for(var i=0,len=ts.length;i<len;i++) {
						var t = ts[i];
						if (t) {
							
							var href = t.innerHTML;
							urls.push(href);
						} else {
							console.log('invalid html');
						}
					}
					
					if (typeof window.callPhantom === 'function') {
					    window.callPhantom(urls);
					} else {
						console.log('not support callPhantom');
					}
				} catch(e) {
					if (typeof window.callPhantom === 'function') {
					    window.callPhantom(null);
					} else {
						console.error('an error occured when naviate the ' + index + 'th page',e);
					}
				}
				
				
				
			});
		},1000);
		
	}
	page.open(pageUrl);	
	
}

function navigateToUrl(url,index) {
	url = 'http:' + url;
	var page = webpage.create();
	var navigatedUrl = '';
	page.onNavigationRequested = function(url, type, willNavigate, main) {
	    console.log('Trying to navigate to: ' + url);
	    navigatedUrl = url;
	}

	
	page.onResourceError = function(resourceError) {
	    var reason = resourceError.errorString;
	    var reason_url = resourceError.url;
	    console.warn('nagigate to url ' + reason_url + ' ' + reason);	    	
    	
//    	console.warn('Unable to access network:'+url);
        try {
        	errorStream.writeLine(reason_url);
        	errorStream.flush();
        } catch (e) {
        	console.error('an error occured when save wrong url',e);
        }
	};



	page.open(url,function(status) {
		hasNavigatedCount++;
		
		console.log('has navigated ' + hasNavigatedCount + 'th pages.');
		if (hasNavigatedCount == linkLen) {
			errorStream.close();
			okStream.close();
        	phantom.exit();
	    }
	});	
}

function realUrlTimer(url,index) {
	setTimeout(function() {
		navigateToUrl(url,index)
	},1000*index);
}

function getRealUrl() {
	linkLen = totalLinks.length;
	if (linkLen > 0) {
		for (var i=0;i<linkLen;i++) {
			realUrlTimer(totalLinks[i],i);
		}
	} else {
		console.warn('totalLinks is empty.');
		phantom.exit();
	}
}

