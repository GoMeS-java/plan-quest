/* Опциональная реальная погода: без геолокации, с офлайн-резервом. */
(function(root){
'use strict';
var CACHE_KEY='plan.citadel.weather.v1';var CITY_KEY='plan.citadel.weather.city.v1';
function mapCode(code){
 if(code===0||code===1)return 'clear';
 if(code===2||code===3||code===45||code===48)return 'fog';
 if(code===51||code===53||code===55||code===56||code===57||code===61||code===63||code===65||code===66||code===67||code===80||code===81||code===82||code===95||code===96||code===99)return 'rain';
 if(code===71||code===73||code===75||code===77||code===85||code===86)return 'snow';
 return 'fog';
}
function cached(){
 try{var value=JSON.parse(root.localStorage.getItem(CACHE_KEY)||'null');return value&&typeof value.weather==='string'?value:null;}catch(_){return null;}
}
function save(data){try{root.localStorage.setItem(CACHE_KEY,JSON.stringify(data));}catch(_){}}
async function lookup(city){
 city=String(city||'').trim();
 if(city.length<2||city.length>100)throw Error('Укажи название города (2–100 символов).');
 var geo=await fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(city)+'&count=1&language=ru&format=json');
 if(!geo.ok)throw Error('Не удалось найти город.');
 var places=await geo.json();
 if(!places.results||!places.results.length)throw Error('Город не найден.');
 var place=places.results[0];
 var forecast=await fetch('https://api.open-meteo.com/v1/forecast?latitude='+encodeURIComponent(place.latitude)+'&longitude='+encodeURIComponent(place.longitude)+'&current=weather_code&timezone=auto');
 if(!forecast.ok)throw Error('Сервис погоды недоступен.');
 var data=await forecast.json();
 if(!data.current||!Number.isFinite(Number(data.current.weather_code)))throw Error('Нет данных о погоде.');
 var result={city:place.name,country:place.country||'',weather:mapCode(Number(data.current.weather_code)),code:Number(data.current.weather_code),fetchedAt:Date.now()};
 save(result);try{root.localStorage.setItem(CITY_KEY,city);}catch(_){}return result;
}
function savedCity(){try{return root.localStorage.getItem(CITY_KEY)||'';}catch(_){return '';}}
root.CitadelWeather=Object.freeze({lookup:lookup,cached:cached,mapCode:mapCode,savedCity:savedCity});
})(window);
