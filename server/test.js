// function p() {
//     return new Promise((resolve, reject) => {
//         setTimeout(() => {
//             reject(3000);
//         }, 1000);
//     });
// }

// function f() {
//     return p().then(() => {
//         console.log(1)
//         return new Promise(res => {res()})
//     }).catch(err => {
//         console.log(err);
//     })
// }

// f().then(() => {
//     console.log(2);
// })

function p1(cb) {
    cb(3);
}

function p2(cb) {
    p1(cb.bind(this, null))
    console.log(cb.bind(this, null).toString())
}

p2((err,m) => {
    console.log(m);
})
function f(a){
    return a + 1;
}
// console.log(f.toString())