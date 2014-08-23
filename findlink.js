/**
 * @copyright yunnysunny <yunnysunny@gmail.com>
 * @license MIT 
 * 
 * 最近新网的DNS被黑，导致很多网站的域名被泛解析，我的网站whyun.com也不幸中招。
 * 在搜索引擎中搜site:whyun.com，会出现大量的垃圾网站，都是博彩网站的网页。
 * 但是这些垃圾网页的链接已经全部失效了。
 * 给百度提交反馈，得到的回复总是：
 * `本分类仅受理来自网页搜索的用户反馈(包括快照的更新、删除等)，原网站未删除的请先联系原网站删除`。
 * 着实令人恼火，每次提交反馈得到的反馈都是一样的，明显是敷衍。所以才有了提交死链的想法。
 * 
 * 
 * 说到提交死链，在google的站长工具中也是可以，具体位置在
 * https://www.google.com/webmasters/tools/removals?hl=zh-cn，遗憾的是google没有提供批量添加死链的功能。
 * 不过提交给google处理的死链一般一天的时间就能处理完。同样在百度站长平台中，具体位置在
 * 百度站长平台->数据提交->死链提交，打开界面后需要提交一个死链文件的链接地址。但是这个死链文件
 * 格式必须是xml格式的，具体格式如下：
 * 	<?xml version="1.0" encoding="UTF-8"?>
	<urlset>
		<url>
			<loc>死链地址1</loc>
		</url>
		<url>
			<loc>死链地址2</loc>
		</url>
	<urlset>
	如果手动编辑这个文件太费劲，所以才有了这个工具。
	
	首先这个工具是使用phantomjs脚本编写的，所以必须先去其官网下载http://phantomjs.org/download.html
	下载完之后，解压到一个任意目录，然后把这个目录追加到系统的`PATH`变量中，保证在命令行中输入phantomjs
	能够访问这个命令。然后运行
	
	`phantomjs 脚本文件路径 搜索条件 要处理的分页数`
	
	`脚本文件路径`肯定就是指当前脚本文件的存放目录，`搜索条件`是提交到百度的搜索条件，
	比如要查看我的网站whyun.com的所有收录，则可以输入	`site:whyun.com`，
	`要处理的分页数`是由于百度出来的搜索结果是分页的，这里告诉程序处理多少个分页。
	
	最终结果会生成到error_links.xml中。
 * 
 */
var fs = require('fs');
var webpage = require('webpage');
var system = require('system');


var keyword = 'site:whyun.com';
var searchUrl = 'http://www.baidu.com/s?ie=utf-8&wd=';
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

var errorStream = fs.open("error_links.xml","w");
var okStream = fs.open('ok_links.txt','w');

errorStream.writeLine('<?xml version="1.0" encoding="UTF-8"?>');
errorStream.writeLine('<urlset>');

for (var i=0;i<num;i++) {
	var pageOffset = i*10;
	var pageUrl = searchUrl + '&pn=' + pageOffset;
	
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
					var ts = document.getElementsByClassName('t');
					console.log("link area length:"+ts.length);
					for(var i=0,len=ts.length;i<len;i++) {
						var t = ts[i];
						if (t) {
							var a = t.getElementsByTagName('a')[0];
							var href = a.getAttribute('href');
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
	
	page.onResourceError = function(resourceError) {
	    var reason = resourceError.errorString;
	    var reason_url = resourceError.url;
	    console.warn('nagigate to url ' + reason_url + ' ' + reason);	    	
	    
        try {
        	errorStream.writeLine('\t<url>');
        	errorStream.writeLine('\t\t<loc>'+reason_url+'</loc>');
        	errorStream.writeLine('\t</url>');
        	errorStream.flush();
        } catch (e) {
        	console.error('an error occured when save wrong url',e);
        }
        
	};

	page.open(url,function(status) {
		hasNavigatedCount++;

		console.log('has navigated ' + hasNavigatedCount + 'th pages.');
		if (hasNavigatedCount == linkLen) {
			errorStream.writeLine('</urlset>');
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

